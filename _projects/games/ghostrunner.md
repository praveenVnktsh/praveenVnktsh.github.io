---
title: GhostRunner 
subtitle: Evolution of Plu - A casual game
contributors: Praveen Venkatesh
date: 2018-10-01
image: ../images/ghostrunner.png
carousels:
  - images: 
    - image: ../images/ghostrunner.png
      desc: Ghostrunner in its full glory.
    - image: ../images/ghostrunner_1.png
      desc: Inspired from an earlier project I had done.
order: -80
---

<iframe width="420" height="315" src="http://www.youtube.com/embed/XRkFX9Xi2_Y" frameborder="0" allowfullscreen></iframe>


This was the first fully-fledged project that I did after joining IITGN. It is an extremely difficult, yet groovy game inspired by the classic arcades - Snake and Pacman, built atop the pygame library for python. I wrote most of the UI elements from scratch and implemented several nifty things that are abstracted to the user. AI for the enemies, quick pathfinding, drunken map auto-generation, and user implemented map creation were just some of them.

Presented at Ignite IITGN 2018

GhostRuunner is a Pacman-like endless arcade game which involves the player, “Plu”, running from its enemies, “the Ghosts”. It is a fast-paced, difficult, and groovy game which involves the player to achieve as high a score as possible.

Making the game involved the use of “pygame”, a library for python which is mainly used for the creation of python games. It has extensive use of a graphical interface.

Behind the screens, it uses a tile-based system for manipulation

Features:

- Uses UI elements like button and textView built from scratch
- Splash screen
- Non-standard, non-system fonts are used
- Uses music elements playing on different channels
- UI is completely menu based
- Ghost AI was implemented uniquely
- The red ghost
- Fully featured level/map designer was made from scratch.
- Map Designer includes the use of a procedural generation algorithm: The drunken walk algorithm(modified)
- Node finding algorithm to direct ghosts
- Unique scoring system
- Lose 1 point for each second spent
- Eat food to gain points
- Multiple Level implementation
- Single time view tutorial screen for instructing the user on how to play the game
- Mouse cursor-based UI system
- Highscore system.
- Saves high scores over multiple game-runs.
- Uses the JSON library to save game variables over multiple game-runs by using files.


This project was the successor of the game I developed for my class 12 CBSE project in pure C++ with no rendering engine. It was a truly difficult project.

<iframe width="420" height="315" src="http://www.youtube.com/embed/nBoFPWLgfSA" frameborder="0" allowfullscreen></iframe>



