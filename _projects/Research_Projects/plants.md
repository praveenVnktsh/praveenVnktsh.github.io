---
order: -20
title: Perception Stack for an Agrobot
subtitle: Single View Segmentation and Modelling of Vegetable Seedlings
contributors: Praveen Venkatesh
date: 2021-12-01
image: ../images/iterations_plants.png
carousels: 
  - images: 
    - image: ../images/procedural.png
      desc: Synthetic plant dataset created on blender.
    - image: ../images/iterations_plants.png
      desc: Plant model being fit iteratively on the observed image.
    - image: ../images/annotator.png
      desc: An automatic annotation tool developed for this project.
---

Robotics for agriculture has seen an increasing amount of interest, particularly in automating tasks that are labour intensive. In this work, we focus on building a vision system for automatically constructing a deformable model of a plant from a given front-facing plant image. We use a learning-based classification step to pre-segment the observed image into stems and leaves and apply a gradient descent based method for fitting a deformable model of the stems onto the observed image. Individual stem portions are stitched together using a directed search to make a complete model. The proposed methodology will serve as a framework for automatic image understanding for agricultural robots in greenhouses