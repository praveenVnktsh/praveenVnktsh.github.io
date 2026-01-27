"""
Written by Praveen Venkatesh <praveenvnktsh@cmu.edu>, January 2026.

Generate a 3D point cloud from image edges using Canny detection and monocular depth.

Pipeline:
    +-------+      +-------+      +-------------+      +-----------+
    | Image | ---> | Canny | ---> | Sample pts  | ---> | 3D points |
    +-------+      +-------+      +-------------+      +-----------+
        |                              ^
        v                              |
    +----------------+                 |
    | Depth Anything | ----------------+
    +----------------+        (z = depth[y, x])

Copyright (C) Mach9 Robotics, Inc - All Rights Reserved
Proprietary and confidential
"""

from __future__ import annotations

import logging
import pathlib

import click
import cv2
import numpy as np
import torch
from PIL import Image
from transformers import pipeline

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def _load_depth_model(device: str) -> pipeline:
    """
    Load Depth Anything v2 pipeline from HuggingFace.

    Args:
        device (str): Device to run on ("cuda" or "cpu").

    Returns:
        pipeline: HuggingFace depth estimation pipeline.
    """
    log.info("Loading Depth Anything v2 model...")
    return pipeline(
        task="depth-estimation",
        model="depth-anything/Depth-Anything-V2-Small-hf",
        device=device,
    )


def _estimate_depth(depth_pipe: pipeline, image_path: pathlib.Path) -> np.ndarray:
    """
    Run monocular depth estimation on an image.

    Args:
        depth_pipe (pipeline): HuggingFace depth pipeline.
        image_path (pathlib.Path): Path to input image.

    Returns:
        np.ndarray: Depth map of shape (H, W) as float32, values normalized to [0, 1].
    """
    pil_image = Image.open(image_path).convert("RGB")
    result = depth_pipe(pil_image)
    depth = np.array(result["depth"], dtype=np.float32)

    # Normalize to [0, 1] range
    depth = (depth - depth.min()) / (depth.max() - depth.min())
    return depth


def _sample_edge_points(
    edges: np.ndarray,
    depth: np.ndarray,
    num_points: int,
    seed: int,
) -> np.ndarray:
    """
    Sample edge points from a Canny edge map with depth values.

    Args:
        edges (np.ndarray): Binary edge image (H, W).
        depth (np.ndarray): Depth map (H, W) normalized to [0, 1].
        num_points (int): Number of points to sample.
        seed (int): RNG seed for sampling.

    Returns:
        np.ndarray: Sampled points with shape (N, 3) as float32, where z is depth.
    """
    #
    #  edges:       depth:        output:
    #  ####..#      0.1 0.2 ...   (x, y, z=depth[y,x])
    #  ##..#.#      0.5 0.3 ...
    #  ..###..      0.8 0.9 ...
    #
    ys, xs = np.where(edges > 0)
    indices = np.random.default_rng(seed).choice(len(xs), size=num_points, replace=False)

    sampled_xs = xs[indices]
    sampled_ys = ys[indices]
    sampled_zs = depth[sampled_ys, sampled_xs]

    points = np.stack([sampled_xs, sampled_ys, sampled_zs], axis=1)
    return points.astype(np.float32)


def _write_ply(points: np.ndarray, output_path: pathlib.Path) -> None:
    """
    Write points to an ASCII PLY file.

    Args:
        points (np.ndarray): Point array of shape (N, 3).
        output_path (pathlib.Path): Destination file path.
    """
    header = "\n".join(
        [
            "ply",
            "format ascii 1.0",
            f"element vertex {points.shape[0]}",
            "property float x",
            "property float y",
            "property float z",
            "end_header",
        ]
    )
    lines = [header] + [f"{p[0]} {p[1]} {p[2]}" for p in points]
    output_path.write_text("\n".join(lines))


def _write_npy(points: np.ndarray, output_path: pathlib.Path) -> None:
    """
    Write points to a numpy .npy file.

    Args:
        points (np.ndarray): Point array of shape (N, 3).
        output_path (pathlib.Path): Destination file path.
    """
    np.save(output_path, points)


@click.command()
@click.option("--image-path", type=click.Path(path_type=pathlib.Path), required=True)
@click.option("--output-path", type=click.Path(path_type=pathlib.Path), required=True)
@click.option("--num-points", type=int, required=True)
@click.option("--canny-low", type=int, default=100)
@click.option("--canny-high", type=int, default=200)
@click.option("--seed", type=int, default=7)
@click.option("--depth-scale", type=float, default=100.0, help="Scale factor for depth values.")
@click.option("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
def main(
    image_path: pathlib.Path,
    output_path: pathlib.Path,
    num_points: int,
    canny_low: int,
    canny_high: int,
    seed: int,
    depth_scale: float,
    device: str,
) -> None:
    """
    Run Canny + depth estimation to produce a 3D point cloud.

    Args:
        image_path (pathlib.Path): Input image path.
        output_path (pathlib.Path): Output file path (.ply or .npy).
        num_points (int): Number of points to sample.
        canny_low (int): Canny low threshold.
        canny_high (int): Canny high threshold.
        seed (int): RNG seed.
        depth_scale (float): Scale factor applied to normalized depth values.
        device (str): Device for depth model ("cuda" or "cpu").
    """
    log.info(f"Processing {image_path}")

    # Load depth model and estimate depth
    depth_pipe = _load_depth_model(device)
    depth = _estimate_depth(depth_pipe, image_path)
    log.info(f"Depth map shape: {depth.shape}")

    # Run Canny edge detection
    image = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    edges = cv2.Canny(image, canny_low, canny_high)
    log.info(f"Found {np.sum(edges > 0)} edge pixels")

    # Sample points with depth
    points = _sample_edge_points(edges, depth, num_points, seed)

    # Scale depth values
    points[:, 2] *= depth_scale

    log.info(f"Sampled {points.shape[0]} 3D points")

    if output_path.suffix.lower() == ".ply":
        _write_ply(points, output_path)
    else:
        _write_npy(points, output_path)

    log.info(f"Wrote output to {output_path}")


if __name__ == "__main__":
    main()
