---
order: -20
home: 10
title: Learning by Cheating
subtitle: End-to-End Framework for Autonomous Drone Navigation 
contributors: Praveen Venkatesh, Viraj Shah*, Vrutik Shah*, Yash Kamble* 
date: 2021-06-01
image: ../images/cheating.gif
carousels: 
  - images: 
    - image: ../images/cheating_1.png
      desc: Architecture
    - image: ../images/cheating.gif
      desc: Drone flying through gates autonomously.
---
This paper proposes a novel framework for autonomous drone navigation through a cluttered environment. Control policies are learnt in a low-level environment during training and are applied to a complex environment during inference. The controller learnt in the training environment is tricked into believing that the robot is still in the training environment when it is actually navigating in a more complex environment. 