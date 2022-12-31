---
title: Battleship 
subtitle: Battle of the Legends
contributors: Praveen Venkatesh
date: 2020-04-16
image: '../images/battleship.png'
carousels: 
  - images: 
    - image: '../images/battleship.png'
      desc: Rendered game
order: -80
---

Developed a refreshed version of battleship in pure python with a lot of VFX and animations. Created a computer AI that uses the most efficient strategy for defeating the opponent, and experimented with reinforcement learning algorithms for the same.

Developed under Project ISAAC @ IITGN

### Rules

Rules for the game are simple:

- Place your ship on the grid in whatever orientation you want on the 10x10 board.
- Press any key (or space) to rotate your selected ship.
- Press F1 to begin the game.
- The goal of the game is to sink all of the computer's ships.
- Press on the tile of your choice to make your attack.
- Sink all of the enemy ships before the computer sinks yours.

### Computer AI

The AI uses the following policy to make decisions on where to hit:

- Shoot random tiles until a hit is achieved.
- Once a tile is determined to be a hit on a ship, find the orientation in which the ship is placed by hitting the tiles around it.
- Once the orientation is determined, destroy the ship until the ship is sunk.
- Repeat from step 1.
