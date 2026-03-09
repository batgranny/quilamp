// Basic audio player state
const audio = new Audio();
let trackList = [];
let currentTrackIndex = -1;

// DOM Elements
const timeDisplay = document.getElementById('time-display');
const trackNameDisplay = document.querySelector('.marquee span');
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnStop = document.getElementById('btn-stop');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');
const btnEject = document.getElementById('btn-eject');
const volumeSlider = document.getElementById('volume-slider');
const playlistItemsContainer = document.getElementById('playlist-items');

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
}

// Update track name and play
function loadTrack(index) {
    if (index >= 0 && index < trackList.length) {
        currentTrackIndex = index;
        const filePath = trackList[index];
        // Very basic extraction of filename
        const fileName = filePath.split('/').pop().split('\\').pop();

        // Original winamp prepends track number
        trackNameDisplay.textContent = `${index + 1}. ${fileName}`;

        // Load local file
        audio.src = `file://${filePath}`;
        audio.play();
        renderPlaylist();
    }
}

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
    if (currentTrackIndex < trackList.length - 1) {
        loadTrack(currentTrackIndex + 1);
    }
});

btnPrev.addEventListener('click', () => {
    if (audio.currentTime > 3) {
        // restart song if > 3s in
        audio.currentTime = 0;
    } else if (currentTrackIndex > 0) {
        // go to previous if <= 3s in
        loadTrack(currentTrackIndex - 1);
    }
});

volumeSlider.addEventListener('input', (e) => {
    audio.volume = e.target.value / 100;
});

// Load files via IPC
if (window.electronAPI) {
    btnEject.addEventListener('click', async () => {
        const filePaths = await window.electronAPI.openFileDialog();
        if (filePaths && filePaths.length > 0) {
            // Append to playlist or replace
            // For now, replace
            trackList = filePaths;
            loadTrack(0);
        }
    });

    // Drag and Drop support
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const filePaths = Array.from(e.dataTransfer.files).map(f => f.path);
            trackList = trackList.concat(filePaths);
            if (!audio.src) {
                loadTrack(trackList.length - filePaths.length); // Play first newly added track
            }
        }
    });
} else {
    console.warn("Running in browser, local file loading via dialog not available.");
}
