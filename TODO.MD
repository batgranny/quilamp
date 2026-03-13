1. [x] write a script that can be run from the command line that will build the project and then run the electron app.  Place it in a /scripts directory

2. [x] Write a script that can be run from the command line that will build the .dmg file.  Place it in a /scripts directory.  

2. [x] The player should move on to the next track when the current track finishes until the items in the playlist have all been played

3. [x] The icon.png image should be used as the application icon when the application is run from the command line and when the .dmg file is run.  Place it in an appropriatw location

4. [x] An about window should be created that is accessable from the mac application bar.  It should display the version number, the date of the build, a link to the GitHub repository and the author.  

5. [x] Implement a right click context menu that allows the user to choose a skin from the /skins folder or the default UI and various other functions.  The flow should be:

 right click > 
   Open File(s) (Should allow loading of files and playlists)
   Open Folder (Should allow loading of a folder of files)
   Themes >  
      Default
      /SKINS FOLDER ITEM1
      /SKINS FOLDER ITEM2
      etc
      Load Skin (should allow the user to browse the computer for a winamp skin file)
   Quit Quillamp (should exit the application)
   About Quillamp (should open the about window)
      

6. The 'repeat' and 'shuffle' buttons should toggle on and off when clicked and they currently do no work

7. The track progress slider should proceed across the full length of the progress bar, currently it will stop at the end of the track at around the 60% mark

8. The volume slider does not currently follow the mouse when clicked and dragged. When dragging left the slider will not move until kthe mouse has moved beyond the slider runner. I will then start to slide to the left. The same issue occurs with the pan slider

9. In non-skinned mode the track title is not displayed. It is displayed in skinned mode

10. Replace the font for the time elapsed display for something closer to the original Winamp font

11. when resizing the playlist window upward at a certain point the whole playlist window starts to move upward and ends up over the main player window (although the transport controls remain in place). The playlist window should not move beyond the bottom of the main player window and resizing upward should stop when the playlist window is around the equivilent of four track titles high

