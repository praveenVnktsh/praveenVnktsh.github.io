---
order: -20
title: Autonomous Race-car
subtitle: A Joint Perception and Control Framework for a High Speed Autonomous Racecar
contributors: Praveen Venkatesh*, Rwik Rana*
date: 2022-01-01
image: ../images/CAR.png
carousels: 
  - images: 
    - image: ../images/CAR.png
      desc: Autonomous racecar in 1/10th scale.
    - image: ../images/car_1.png
      desc: Architecture
---
Title is self explanatory :)

Basically, we need fast inference speeds, and robust perception and control. 

We first learn  latent representation of the world, and use it to directly regress to control points before bezier interpolation to get a planned path. 

Ideal race lines are learnt by a  genetic evolution based speciation strategy. 