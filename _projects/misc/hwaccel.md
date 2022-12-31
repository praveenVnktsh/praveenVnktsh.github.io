---
title: Hardware Accelerated Motion Estimation
subtitle: Accelerating Block Matching by 8000x
contributors: Chris Francis*, Praveen Venkatesh*, Nishikant Parmar*, Prankush Agarwal Prof Joycee Mekie
date: 2019-11-17
image: ../images/ds.png
carousels: 
  - images: 
    - image: '../images/blockmatching.png'
      desc: The magic of block matching at work.
    - image: '../images/ds.png'
      desc: The crux of the FSBM algorithm.
order: -70
---

<iframe width="420" height="315" src="http://www.youtube.com/embed/ZtyWjcTnX9U" frameborder="0" allowfullscreen></iframe>



**Deemed best course project for Digital Systems, 2019 @ IITGN**

Designed a motion estimation processor that estimates the motion of objects between two adjacent frames in a video. Implemented the Full Search Block Matching algorithm for processing and a VGA controller for displaying the results. Utilized an asynchronous handshake based finite state machine for implementing the algorithm on a NEXYS 4 DDR FPGA. 


## Results
- Achieved *8000x* improvement in speed compared to a python script running on an Intel i5-8250u. This system forms a fundamental block in several video compression methods.
- I learnt that Verilog isn't something I want to do for the rest of my life XD.
