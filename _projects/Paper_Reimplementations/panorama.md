---
title: Panorama Stitching
subtitle: Entrypoint into cameras
contributors: Praveen Venkatesh 
date: 2022-01-01
image: ../images/panorama.png
order: -30
---
Here, I attempt to solve the problem of stitching a set of ../images taken to form a panorama. I employed ORB feature matching between adjacent ../images, computed homography to match orientations, and applied Laplacian blending to stitch the ../images seamlessly.