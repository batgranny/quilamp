import JSZip from 'jszip';
import 'jsmediatags/dist/jsmediatags.min.js';

// Basic audio player state
const audio = new Audio();
let trackList = [];
let currentTrackIndex = -1;
// Global player state for easier debugging and persistence
window.playerState = {
    isShuffle: false,
    isRepeat: false
};

// DOM Elements
const timeDisplay = document.getElementById('time-display');
const trackNameDisplay = document.querySelector('.marquee span');
const titleText = document.querySelector('.title-text');
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnStop = document.getElementById('btn-stop');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');
const btnEject = document.getElementById('btn-eject');
const volumeSlider = document.getElementById('volume-slider');
const volumeThumb = document.getElementById('volume-thumb');
const panSlider = document.getElementById('pan-slider');
const panThumb = document.getElementById('pan-thumb');
const playlistItemsContainer = document.getElementById('playlist-items');
const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');
const btnShuffle = document.getElementById('btn-shuffle');
const btnRepeat = document.getElementById('btn-repeat');

// Window Controls
if (window.electronAPI) {
    if (btnMinimize) {
        btnMinimize.addEventListener('click', () => {
            window.electronAPI.minimizeWindow();
        });
    }
    if (btnClose) {
        btnClose.addEventListener('click', () => {
            window.electronAPI.closeWindow();
        });
    }
}

// Custom Playlist Scrollbar Logic
function initPlaylistScrollbar() {
    const box = document.getElementById('playlist-box');
    const thumb = document.getElementById('playlist-scroll-thumb');
    const track = document.getElementById('playlist-scrollbar');

    if (!box || !thumb || !track) return;

    let dragging = false;
    let startY = 0;
    let startTop = 0;

    function updateThumb() {
        if (dragging) return;
        const maxScroll = box.scrollHeight - box.clientHeight;
        const trackHeight = track.clientHeight;
        const thumbHeight = thumb.clientHeight;
        const maxTop = Math.max(0, trackHeight - thumbHeight);

        if (maxScroll <= 0) {
            thumb.style.top = '0px';
            return;
        }

        const ratio = box.scrollTop / maxScroll;
        thumb.style.top = `${ratio * maxTop}px`;
    }

    box.addEventListener('scroll', updateThumb);
    box.addEventListener('playlistUpdated', updateThumb);
    window.addEventListener('resize', updateThumb);

    thumb.addEventListener('mousedown', (e) => {
        dragging = true;
        startY = e.clientY;
        startTop = parseFloat(thumb.style.top) || 0;
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const trackHeight = track.clientHeight;
        const thumbHeight = thumb.clientHeight;
        const maxTop = Math.max(0, trackHeight - thumbHeight);

        const deltaY = (e.clientY - startY) / CSS_ZOOM;
        let newTop = startTop + deltaY;
        newTop = Math.max(0, Math.min(newTop, maxTop));
        thumb.style.top = `${newTop}px`;

        const maxScroll = box.scrollHeight - box.clientHeight;
        if (maxScroll > 0 && maxTop > 0) {
            box.scrollTop = (newTop / maxTop) * maxScroll;
        }
    });

    document.addEventListener('mouseup', () => {
        dragging = false;
    });

    track.addEventListener('mousedown', (e) => {
        if (e.target === thumb) return;
        const rect = track.getBoundingClientRect();
        let mouseY = (e.clientY - rect.top) / CSS_ZOOM;
        const trackHeight = track.clientHeight;
        const thumbHeight = thumb.clientHeight;
        const maxTop = Math.max(0, trackHeight - thumbHeight);

        let newTop = mouseY - (thumbHeight / 2);
        newTop = Math.max(0, Math.min(newTop, maxTop));
        thumb.style.top = `${newTop}px`;

        const maxScroll = box.scrollHeight - box.clientHeight;
        if (maxScroll > 0 && maxTop > 0) {
            box.scrollTop = (newTop / maxTop) * maxScroll;
        }

        dragging = true;
        startY = e.clientY;
        startTop = newTop;
        e.preventDefault();
    });
}

initPlaylistScrollbar();

// Custom slider state
let volumeValue = 1.0; // 0-1
let panValue = 0.5;    // 0-1 (0.5 = center)

// CSS zoom factor applied to the body — needed to correct getBoundingClientRect coordinates
const CSS_ZOOM = 1.5;

function makeDraggableSlider(track, thumb, initialValue, onChange, onStart, onEnd) {
    let dragging = false;
    let value = initialValue;
    let dragOffset = 0; // Relative offset from mouse to thumb's left edge (in CSS pixels)

    function positionThumb(ratio) {
        const trackWidth = track.offsetWidth;
        const thumbWidth = thumb.offsetWidth;
        thumb.style.left = `${Math.round(ratio * (trackWidth - thumbWidth))}px`;
    }

    function update(e) {
        const rect = track.getBoundingClientRect();
        const trackWidth = track.offsetWidth;
        const thumbWidth = thumb.offsetWidth;

        // Calculate dynamic zoom: screen pixels vs CSS pixels
        const zoom = rect.width / trackWidth;

        // Calculate mouse position relative to track in CSS pixels
        let mouseX = (e.clientX - rect.left) / zoom;

        // Calculate new target left using normalized mouse and preserved drag offset
        let targetLeft = mouseX - dragOffset;
        let maxLeft = trackWidth - thumbWidth;
        let clampedLeft = Math.max(0, Math.min(maxLeft, targetLeft));

        // Ratio is for the onChange callback (0 to 1)
        value = maxLeft > 0 ? clampedLeft / maxLeft : 0;

        thumb.style.left = `${Math.round(clampedLeft)}px`;
        onChange(value);
    }

    // Set initially
    positionThumb(value);
    // And again after a short delay in case of font/layout shifts
    setTimeout(() => positionThumb(value), 150);

    // Thumb mousedown: start drag, calculate offset within thumb
    thumb.addEventListener('mousedown', (e) => {
        const thumbRect = thumb.getBoundingClientRect();
        const rect = track.getBoundingClientRect();
        const zoom = rect.width / track.offsetWidth;

        // Store how far into the thumb we clicked (in CSS pixels)
        dragOffset = (e.clientX - thumbRect.left) / zoom;

        dragging = true;
        if (onStart) onStart();
        e.preventDefault();
        e.stopPropagation();
    });

    // Track mousedown: click on track to jump there (center knob), then allow drag
    track.addEventListener('mousedown', (e) => {
        const thumbWidth = thumb.offsetWidth;
        // When clicking the track directly, we center the thumb on the mouse
        dragOffset = thumbWidth / 2;

        dragging = true;
        if (onStart) onStart();
        e.preventDefault();
        update(e);
    });

    document.addEventListener('mousemove', (e) => {
        if (dragging) update(e);
    });

    document.addEventListener('mouseup', () => {
        if (dragging && onEnd) onEnd();
        dragging = false;
    });

    return {
        getValue: () => value,
        setValue: (v) => { value = v; positionThumb(v); }
    };
}

const volumeControl = makeDraggableSlider(volumeSlider, volumeThumb, 1.0, (ratio) => {
    volumeValue = ratio;
    audio.volume = ratio;
    // Update track background row if skin is active
    const bmpUrl = getSkinUrl('--skin-volume-bg');
    if (bmpUrl) updateVolumeTrack(ratio, bmpUrl);
});

const panControl = makeDraggableSlider(panSlider, panThumb, 0.5, (ratio) => {
    panValue = ratio;
    // Update track background row if skin is active
    const bmpUrl = getSkinUrl('--skin-balance-bg');
    if (bmpUrl) updatePanTrack(ratio, bmpUrl);
});

// Helper – extract raw URL from a CSS custom property containing url("...")
function getSkinUrl(prop) {
    return document.documentElement.style.getPropertyValue(prop)
        .replace(/^url\(["']?/, '').replace(/["']?\)$/, '').trim();
}

// Format time in MM:SS
function formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// Update time display
audio.addEventListener('timeupdate', () => {
    timeDisplay.textContent = formatTime(audio.currentTime);
});

// Read ID3 tags from a file path using jsmediatags (browser-compatible)
function readID3Tags(filePath) {
    return new Promise((resolve) => {
        try {
            // jsmediatags can read from a URL
            window.jsmediatags.read(`file://${filePath}`, {
                onSuccess: (tag) => {
                    const title = tag.tags.title || null;
                    const artist = tag.tags.artist || null;
                    resolve({ title, artist });
                },
                onError: () => {
                    resolve({ title: null, artist: null });
                }
            });
        } catch (e) {
            resolve({ title: null, artist: null });
        }
    });
}

// Render Playlist
function renderPlaylist() {
    playlistItemsContainer.innerHTML = '';
    trackList.forEach((filePath, index) => {
        const fileName = filePath.split('/').pop().split('\\').pop();
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${fileName}`;

        if (index === currentTrackIndex) {
            li.classList.add('active');
        }

        li.addEventListener('dblclick', () => {
            loadTrack(index);
        });
        playlistItemsContainer.appendChild(li);
    });

    // Notify scrollbar that heights may have changed
    const box = document.getElementById('playlist-box');
    if (box) box.dispatchEvent(new Event('playlistUpdated'));
}

// Update track name and play
async function loadTrack(index) {
    if (index >= 0 && index < trackList.length) {
        currentTrackIndex = index;
        const filePath = trackList[index];
        const fileName = filePath.split('/').pop().split('\\').pop().replace(/\.[^/.]+$/, '');

        // Show filename first as fallback
        trackNameDisplay.textContent = `${index + 1}. ${fileName}`;

        // Load local file
        audio.src = `file://${filePath}`;
        audio.play();
        renderPlaylist();

        // Try to read metadata via IPC
        window.currentTrackDuration = 0;
        if (window.electronAPI && window.electronAPI.getMetadata) {
            const tags = await window.electronAPI.getMetadata(filePath);
            if (tags) {
                if (tags.duration) window.currentTrackDuration = tags.duration;
                if (tags.artist && tags.title) {
                    trackNameDisplay.textContent = `${tags.artist} - ${tags.title}`;
                } else if (tags.title) {
                    trackNameDisplay.textContent = tags.title;
                }
                // else keep the filename
            }
        } else {
            // Fallback for browser testing
            const tags = await readID3Tags(filePath);
            if (tags.artist && tags.title) {
                trackNameDisplay.textContent = `${tags.artist} - ${tags.title}`;
            } else if (tags.title) {
                trackNameDisplay.textContent = tags.title;
            }
        }
    }
}

// Skin Loading Logic
async function applySkin(file) {
    try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);

        const extractImage = async (filename) => {
            const fileKey = Object.keys(contents.files).find(
                key => key.toLowerCase() === filename.toLowerCase()
            );
            if (fileKey) {
                const fileData = await contents.files[fileKey].async("blob");
                return URL.createObjectURL(fileData);
            }
            return null;
        };

        const extractSpriteRegion = async (filename, x, y, width, height) => {
            const url = await extractImage(filename);
            if (!url) return null;
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.src = url;
            });
        };

        // Extract all skin images
        const mainBmpUrl = await extractImage('main.bmp');
        if (mainBmpUrl) document.documentElement.style.setProperty('--skin-main-bg', `url("${mainBmpUrl}")`);

        const titlebarBmpUrl = await extractImage('titlebar.bmp');
        if (titlebarBmpUrl) document.documentElement.style.setProperty('--skin-titlebar-bg', `url("${titlebarBmpUrl}")`);

        const cbuttonsBmpUrl = await extractImage('cbuttons.bmp');
        if (cbuttonsBmpUrl) document.documentElement.style.setProperty('--skin-cbuttons-bg', `url("${cbuttonsBmpUrl}")`);

        const pleditBmpUrl = await extractImage('pledit.bmp');
        if (pleditBmpUrl) document.documentElement.style.setProperty('--skin-pledit-bg', `url("${pleditBmpUrl}")`);

        const shufrepBmpUrl = await extractImage('shufrep.bmp');
        if (shufrepBmpUrl) document.documentElement.style.setProperty('--skin-shufrep-bg', `url("${shufrepBmpUrl}")`);

        const volumeBmpUrl = await extractImage('volume.bmp');
        if (volumeBmpUrl) document.documentElement.style.setProperty('--skin-volume-bg', `url("${volumeBmpUrl}")`);

        const balanceBmpUrl = await extractImage('balance.bmp');
        if (balanceBmpUrl) document.documentElement.style.setProperty('--skin-balance-bg', `url("${balanceBmpUrl}")`);

        const textBmpUrl = await extractImage('text.bmp');
        if (textBmpUrl) document.documentElement.style.setProperty('--skin-text-bg', `url("${textBmpUrl}")`);

        const numbersBmpUrl = await extractImage('numbers.bmp');
        if (numbersBmpUrl) document.documentElement.style.setProperty('--skin-numbers-bg', `url("${numbersBmpUrl}")`);

        const posbarBmpUrl = await extractImage('posbar.bmp');
        if (posbarBmpUrl) document.documentElement.style.setProperty('--skin-posbar-bg', `url("${posbarBmpUrl}")`);

        const genBmpUrl = await extractImage('gen.bmp');
        if (genBmpUrl) document.documentElement.style.setProperty('--skin-gen-bg', `url("${genBmpUrl}")`);

        // Extract specific playlist border slices so they can cleanly repeat-y in CSS purely as a 29px tile
        const pleditLeftUrl = await extractSpriteRegion('pledit.bmp', 0, 42, 12, 29);
        if (pleditLeftUrl) document.documentElement.style.setProperty('--skin-pledit-left', `url("${pleditLeftUrl}")`);

        // Right border slice (at x=31 in pledit.bmp, width=20)
        const pleditRightUrl = await extractSpriteRegion('pledit.bmp', 31, 42, 20, 29);
        if (pleditRightUrl) document.documentElement.style.setProperty('--skin-pledit-right', `url("${pleditRightUrl}")`);

        const pleditBottomLeftUrl = await extractSpriteRegion('pledit.bmp', 0, 72, 125, 38);
        if (pleditBottomLeftUrl) document.documentElement.style.setProperty('--skin-pledit-bottom-left', `url("${pleditBottomLeftUrl}")`);

        // Skip 1px potential cyan divider at x=125 in some skins
        const pleditBottomRightUrl = await extractSpriteRegion('pledit.bmp', 126, 72, 149, 38);
        if (pleditBottomRightUrl) document.documentElement.style.setProperty('--skin-pledit-bottom-right', `url("${pleditBottomRightUrl}")`);

        const pleditBottomFillUrl = await extractSpriteRegion('pledit.bmp', 179, 0, 25, 38);
        if (pleditBottomFillUrl) document.documentElement.style.setProperty('--skin-pledit-bottom-fill', `url("${pleditBottomFillUrl}")`);

        // List Opts Pop-up Menu (NEW | SAVE | LOAD) - 22 width x 42 height
        const pleditMenuUrl = await extractSpriteRegion('pledit.bmp', 43, 42, 22, 42);
        if (pleditMenuUrl) document.documentElement.style.setProperty('--skin-pledit-menu-bg', `url("${pleditMenuUrl}")`);

        const pleditTopLeftUrl = await extractSpriteRegion('pledit.bmp', 0, 21, 25, 20);
        if (pleditTopLeftUrl) document.documentElement.style.setProperty('--skin-pledit-top-left', `url("${pleditTopLeftUrl}")`);

        const pleditTopRightUrl = await extractSpriteRegion('pledit.bmp', 153, 21, 25, 20);
        if (pleditTopRightUrl) document.documentElement.style.setProperty('--skin-pledit-top-right', `url("${pleditTopRightUrl}")`);

        const pleditTopFillUrl = await extractSpriteRegion('pledit.bmp', 127, 21, 25, 20);
        if (pleditTopFillUrl) document.documentElement.style.setProperty('--skin-pledit-top-fill', `url("${pleditTopFillUrl}")`);

        const pleditScrollHandleUrl = await extractSpriteRegion('pledit.bmp', 52, 53, 8, 18);
        if (pleditScrollHandleUrl) document.documentElement.style.setProperty('--skin-pledit-scroll-handle', `url("${pleditScrollHandleUrl}")`);

        // Apply skin-active class NOW — before any optional thumb styling
        document.body.classList.add('skin-active');

        // Set TRACK backgrounds from sprite rows — each row has the fill baked in
        // volume.bmp: 68×433, 28 rows × 15px. Row 27=full bar.
        if (volumeBmpUrl) {
            updateVolumeTrack(volumeValue, volumeBmpUrl);
            const vFill = document.getElementById('volume-fill');
            if (vFill) vFill.style.display = 'none';
        }
        if (balanceBmpUrl) {
            updatePanTrack(panValue, balanceBmpUrl);
            const pFill = document.getElementById('pan-fill');
            if (pFill) pFill.style.display = 'none';
        }

        // Apply knob sprite to thumbs (null-safe)
        const vThumb = document.getElementById('volume-thumb');
        const pThumb = document.getElementById('pan-thumb');
        if (vThumb && volumeBmpUrl) {
            vThumb.style.backgroundImage = `url("${volumeBmpUrl}")`;
            vThumb.style.backgroundRepeat = 'no-repeat';
            vThumb.style.backgroundPosition = '0px -420px';
            vThumb.style.backgroundSize = 'auto auto';
            vThumb.style.backgroundColor = 'transparent';
            vThumb.style.border = 'none';
        }
        if (pThumb && balanceBmpUrl) {
            pThumb.style.backgroundImage = `url("${balanceBmpUrl}")`;
            pThumb.style.backgroundRepeat = 'no-repeat';
            pThumb.style.backgroundPosition = '0px -420px';
            pThumb.style.backgroundSize = 'auto auto';
            pThumb.style.backgroundColor = 'transparent';
            pThumb.style.border = 'none';
        }

        console.log("Skin applied successfully!");
    } catch (e) {
        console.error("Failed to parse skin:", e);
        if (playlistItemsContainer) {
            playlistItemsContainer.innerHTML = `<li style="color:red">Skin Error: ${e.message}</li>`;
        }
    }
}

// Update the volume slider fill row from volume.bmp based on current ratio
// Set volume TRACK background from volume.bmp row (row 0=empty, row 27=full)
// The entire bar image is 68px wide – each row already has fill baked in
function updateVolumeTrack(ratio, bmpUrl) {
    const track = document.getElementById('volume-slider');
    if (!track || !bmpUrl) return;
    const row = Math.round(ratio * 27);
    track.style.backgroundImage = `url("${bmpUrl}")`;
    track.style.backgroundRepeat = 'no-repeat';
    track.style.backgroundPosition = `0px ${-row * 15}px`;
    track.style.backgroundSize = 'auto auto';
    track.style.backgroundColor = 'transparent';
}

// Set pan TRACK background from balance.bmp row (row 0=full-left, 13=center, 27=full-right)
function updatePanTrack(ratio, bmpUrl) {
    const track = document.getElementById('pan-slider');
    if (!track || !bmpUrl) return;
    const row = Math.round(ratio * 27);
    track.style.backgroundImage = `url("${bmpUrl}")`;
    track.style.backgroundRepeat = 'no-repeat';
    track.style.backgroundPosition = `0px ${-row * 15}px`;
    track.style.backgroundSize = 'auto auto';
    track.style.backgroundColor = 'transparent';
}



// UI Elements for playback
const seekThumb = document.getElementById('seek-thumb');
const seekSlider = document.getElementById('seek-slider');
if (!window.isSeekingDeclared) {
    window.isSeeking = false;
    window.isSeekingDeclared = true;
}

const seekControl = makeDraggableSlider(
    seekSlider,
    seekThumb,
    0,
    (ratio) => {
        const duration = audio.duration || window.currentTrackDuration;
        if (duration) {
            audio.currentTime = ratio * duration;
        }
    },
    () => { window.isSeeking = true; },
    () => { window.isSeeking = false; }
);

// Audio element event listeners
audio.addEventListener('timeupdate', () => {
    const duration = audio.duration || window.currentTrackDuration;
    if (!window.isSeeking && duration) {
        seekControl.setValue(audio.currentTime / duration);
    }
});

audio.addEventListener('ended', () => {
    if (!window.isSeeking) {
        seekControl.setValue(1.0);
        playNextTrack(true); // true means it was an automatic end
    }
});

function playNextTrack(isAuto = false) {
    if (trackList.length === 0) return;

    if (window.playerState.isShuffle) {
        let nextIndex;
        if (trackList.length > 1) {
            do {
                nextIndex = Math.floor(Math.random() * trackList.length);
            } while (nextIndex === currentTrackIndex);
        } else {
            nextIndex = 0;
        }
        console.log(`Shuffle: picking track ${nextIndex + 1}`);
        loadTrack(nextIndex);
    } else {
        if (currentTrackIndex < trackList.length - 1) {
            loadTrack(currentTrackIndex + 1);
        } else if (window.playerState.isRepeat) {
            console.log('Repeat: looping to start');
            loadTrack(0);
        } else if (!isAuto) {
            // Manual click on last track loops to start
            loadTrack(0);
        }
    }
}

function playPrevTrack() {
    if (trackList.length === 0) return;

    if (audio.currentTime > 3) {
        audio.currentTime = 0;
    } else {
        if (window.playerState.isShuffle) {
            let prevIndex;
            if (trackList.length > 1) {
                do {
                    prevIndex = Math.floor(Math.random() * trackList.length);
                } while (prevIndex === currentTrackIndex);
            } else {
                prevIndex = 0;
            }
            loadTrack(prevIndex);
        } else {
            if (currentTrackIndex > 0) {
                loadTrack(currentTrackIndex - 1);
            } else {
                loadTrack(trackList.length - 1);
            }
        }
    }
}

// Global UI state updater
function updateToggleButtons() {
    const sBtn = document.getElementById('btn-shuffle');
    const rBtn = document.getElementById('btn-repeat');
    if (sBtn) sBtn.classList.toggle('active', window.playerState.isShuffle);
    if (rBtn) rBtn.classList.toggle('active', window.playerState.isRepeat);
}

// Delegated click listener for UI controls
document.addEventListener('click', (e) => {
    const toggle = e.target.closest('.toggle-btn');
    if (toggle) {
        toggleShuffleRepeat(toggle.id);
    }
});

function toggleShuffleRepeat(id) {
    if (id === 'btn-shuffle') {
        window.playerState.isShuffle = !window.playerState.isShuffle;
        console.log('Shuffle toggled:', window.playerState.isShuffle);
    } else if (id === 'btn-repeat') {
        window.playerState.isRepeat = !window.playerState.isRepeat;
        console.log('Repeat toggled:', window.playerState.isRepeat);
    }
    updateToggleButtons();
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Reserved for future use (e.g. search)
});

// Actions
btnPlay.addEventListener('click', () => {
    if (audio.src) {
        audio.play();
    } else if (trackList.length > 0) {
        loadTrack(0);
    }
});

btnPause.addEventListener('click', () => {
    audio.pause();
});

btnStop.addEventListener('click', () => {
    audio.pause();
    audio.currentTime = 0;
    timeDisplay.textContent = "00:00";
});

btnNext.addEventListener('click', () => {
    playNextTrack(false);
});

btnPrev.addEventListener('click', () => {
    playPrevTrack();
});

// Ensure initial UI state
updateToggleButtons();

volumeSlider.addEventListener('click', () => { /* handled by makeDraggableSlider */ });

// Load files via IPC
if (window.electronAPI) {
    // Eject button (Main Window) - REPLACES playlist
    btnEject.addEventListener('click', async () => {
        const filePaths = await window.electronAPI.openFileDialog();
        if (filePaths && filePaths.length > 0) {
            trackList = filePaths;
            loadTrack(0);
        }
    });

    // ADD button (Playlist Window) - APPENDS to playlist
    const btnPlAdd = document.getElementById('pl-btn-add');
    if (btnPlAdd) {
        btnPlAdd.addEventListener('click', async () => {
            const filePaths = await window.electronAPI.openFileDialog();
            if (filePaths && filePaths.length > 0) {
                const wasEmpty = trackList.length === 0;
                // Avoid duplicates by filtering (optional, but good practice)
                const newPaths = filePaths.filter(p => !trackList.includes(p));
                trackList = trackList.concat(newPaths);

                renderPlaylist();

                // If the playlist was empty and nothing is currently playing, start playing
                if (wasEmpty && !audio.src && trackList.length > 0) {
                    loadTrack(0);
                }
            }
        });
    }

    // Playlist Save/Load Buttons
    const btnPlListOpts = document.getElementById('pl-btn-list-opts');
    const plListOptsMenu = document.getElementById('pl-list-opts-menu');

    const btnPlNew = document.getElementById('pl-btn-list-new');
    const btnPlSave = document.getElementById('pl-btn-list-save');
    const btnPlLoad = document.getElementById('pl-btn-list-load');

    if (btnPlListOpts && plListOptsMenu) {
        btnPlListOpts.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent window click from immediately closing it
            plListOptsMenu.classList.toggle('collapsed');
        });

        // Click outside to close map
        window.addEventListener('click', (e) => {
            if (!plListOptsMenu.contains(e.target) && e.target !== btnPlListOpts) {
                if (!plListOptsMenu.classList.contains('collapsed')) {
                    plListOptsMenu.classList.add('collapsed');
                }
            }
        });
    }

    if (btnPlNew) {
        btnPlNew.addEventListener('click', () => {
            trackList = [];
            currentTrackIndex = -1;
            audio.src = '';
            document.querySelector('.marquee span').textContent = '*** QUILLAMP *** WINAMP CLONE ***';
            timeDisplay.textContent = '00:00';
            renderPlaylist();
        });
    }

    if (btnPlSave) {
        btnPlSave.addEventListener('click', async () => {
            if (trackList.length > 0) {
                await window.electronAPI.savePlaylist(trackList);
            }
        });
    }

    if (btnPlLoad) {
        btnPlLoad.addEventListener('click', async () => {
            const loadedTracks = await window.electronAPI.loadPlaylist();
            if (loadedTracks && loadedTracks.length > 0) {
                trackList = loadedTracks;
                renderPlaylist();
                loadTrack(0);
            }
        });
    }

    // Drag and Drop support
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);

            // Collect audio files separately from skins
            const audioPaths = [];

            files.forEach(file => {
                if (file.name.toLowerCase().endsWith('.wsz') || file.name.toLowerCase().endsWith('.zip')) {
                    applySkin(file);
                } else {
                    audioPaths.push(file.path);
                }
            });

            if (audioPaths.length > 0) {
                trackList = trackList.concat(audioPaths);
                if (!audio.src) {
                    loadTrack(trackList.length - audioPaths.length); // Play first newly added track
                }
                renderPlaylist();
            }
        }
    });

    // Right-click Context Menu
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        window.electronAPI.showContextMenu();
    });

    // Handle skin loading from context menu
    window.electronAPI.onLoadSkin(async (data) => {
        if (data.isDir) {
            // Directory skins not fully supported yet in this JSZip-based flow
            console.warn("Directory skins not yet supported via context menu");
            return;
        }
        const buffer = await window.electronAPI.readSkinFile(data.path);
        if (buffer) {
            const blob = new Blob([buffer]);
            applySkin(blob);
        }
    });

    // Handle reset skin
    window.electronAPI.onResetSkin(() => {
        document.body.classList.remove('skin-active');
        // Clear skin variables
        const props = [
            '--skin-main-bg', '--skin-titlebar-bg', '--skin-cbuttons-bg', '--skin-pledit-bg',
            '--skin-shufrep-bg', '--skin-volume-bg', '--skin-balance-bg', '--skin-text-bg',
            '--skin-numbers-bg', '--skin-posbar-bg', '--skin-gen-bg', '--skin-pledit-left',
            '--skin-pledit-right', '--skin-pledit-bottom-left', '--skin-pledit-bottom-right',
            '--skin-pledit-bottom-fill', '--skin-pledit-menu-bg', '--skin-pledit-top-left',
            '--skin-pledit-top-right', '--skin-pledit-top-fill', '--skin-pledit-scroll-handle'
        ];
        props.forEach(p => document.documentElement.style.removeProperty(p));

        // Reset slider backgrounds
        const vTrack = document.getElementById('volume-slider');
        const pTrack = document.getElementById('pan-slider');
        if (vTrack) vTrack.style.backgroundImage = '';
        if (pTrack) pTrack.style.backgroundImage = '';

        // Reset fill displays
        const vFill = document.getElementById('volume-fill');
        const pFill = document.getElementById('pan-fill');
        if (vFill) vFill.style.display = '';
        if (pFill) pFill.style.display = '';

        // Reset thumbs
        const vThumb = document.getElementById('volume-thumb');
        const pThumb = document.getElementById('pan-thumb');
        if (vThumb) vThumb.style.cssText = '';
        if (pThumb) pThumb.style.cssText = '';

        console.log("Skin reset to default");
    });

    // Handle adding tracks from context menu
    window.electronAPI.onAddTracks((paths) => {
        if (paths && paths.length > 0) {
            const wasEmpty = trackList.length === 0;
            const newPaths = paths.filter(p => !trackList.includes(p));
            trackList = trackList.concat(newPaths);
            renderPlaylist();
            if (wasEmpty && !audio.src && trackList.length > 0) {
                loadTrack(0);
            }
        }
    });

} else {
    console.warn("Running in browser, local file loading via dialog not available.");
}
