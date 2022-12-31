---
order: -20
title: Memory Guided Road Segmentation
subtitle: Making Cars See the World
contributors: Praveen Venkatesh, Varun Jain, Rwik Rana
date: 2021-05-01
image: ../images/memseg.gif
carousels: 
  - images: 
    - image: ../images/memseg_1.png
      desc: Architecture
    - image: ../images/memseg.gif
      desc: Predictions.
---

In self-driving car applications, there is a requirement to predict the location of the road given an input RGB front-facing image. We propose a framework that utilizes an interleaving strategy of large and small feature extractors assisted via a propagating shared feature space allowing us to realize gains of over 2.5X in speed with a negligible loss in the accuracy of predictions. By utilizing the gist of previously observed frames, we train the network to predict the current road with greater accuracy and lesser deviation from previous frames.