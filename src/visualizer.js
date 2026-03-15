import butterchurn from 'butterchurn';
import butterchurnPresets from 'butterchurn-presets';

const canvas = document.getElementById('canvas');
const infoEl = document.getElementById('info');

let visualizer = null;
let presets = null;
let presetKeys = [];
let currentPresetIndex = 0;

let audioContext = null;
let analyser = null;
let silentSource = null;
let scriptNode = null;

let lastAudioData = null;
let lastAudioTime = 0;
let frameCount = 0;

function updateStatus(text, isError = false) {
    console.log(`[Visualizer] ${text}`);
    if (infoEl) {
        infoEl.innerText = text;
        if (isError) {
            infoEl.style.color = '#ff9090';
            infoEl.style.fontWeight = 'bold';
        } else {
            infoEl.style.color = 'rgba(255, 255, 255, 0.5)';
            infoEl.style.fontWeight = 'normal';
        }
    }
}

// Global error handling
window.onerror = (msg, url, line, col, error) => {
    updateStatus(`JS Error: ${msg} (${line}:${col})`, true);
    return false;
};

function initAudioBridge() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;

        // Use a ScriptProcessor to inject audio data arriving via IPC
        // 1024 buffer size, 0 inputs, 1 output (mono is fine for viz)
        scriptNode = audioContext.createScriptProcessor(1024, 0, 1);
        
        scriptNode.onaudioprocess = (e) => {
            const output = e.outputBuffer.getChannelData(0);
            if (lastAudioData && lastAudioData.timeData) {
                // Convert Uint8 (0-255) to Float32 (-1.0 to 1.0)
                const data = lastAudioData.timeData;
                for (let i = 0; i < output.length; i++) {
                    // Safety check: if our IPC buffer is smaller than block size
                    if (i < data.length) {
                        output[i] = (data[i] - 128) / 128.0;
                    } else {
                        output[i] = 0;
                    }
                }
            } else {
                output.fill(0);
            }
        };

        // Connect everything: Script -> Analyser -> Destination (muted)
        const gain = audioContext.createGain();
        gain.gain.value = 0; // Mute local output

        scriptNode.connect(analyser);
        analyser.connect(gain);
        gain.connect(audioContext.destination);

        updateStatus('Audio bridge initialized');
        return true;
    } catch (e) {
        updateStatus(`Audio Bridge Error: ${e.message}`, true);
        return false;
    }
}

function start() {
    try {
        presets = butterchurnPresets.getPresets();
        presetKeys = Object.keys(presets);
        if (presetKeys.length === 0) throw new Error('No presets found');
        currentPresetIndex = Math.floor(Math.random() * presetKeys.length);
    } catch (e) {
        console.error('Fatal: Preset load failed', e);
        return;
    }

    if (!initAudioBridge()) return;

    try {
        visualizer = butterchurn.createVisualizer(audioContext, canvas, {
            width: window.innerWidth,
            height: window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1,
            textureRatio: 1,
        });
        
        visualizer.connectAudio(analyser);
        
        const initialPreset = presets[presetKeys[currentPresetIndex]];
        visualizer.loadPreset(initialPreset, 0.0);
    } catch (e) {
        console.error('ProjectM Init Error:', e);
        return;
    }

    if (window.electronAPI && window.electronAPI.onAudioData) {
        window.electronAPI.onAudioData((data) => {
            lastAudioData = data;
            lastAudioTime = Date.now();
            
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
        });
    }

    window.addEventListener('resize', () => {
        if (visualizer) {
            visualizer.setInternalCanvasSize(window.innerWidth, window.innerHeight);
        }
    });

    setInterval(() => {
        if (visualizer) {
            currentPresetIndex = (currentPresetIndex + 1) % presetKeys.length;
            const nextPreset = presets[presetKeys[currentPresetIndex]];
            visualizer.loadPreset(nextPreset, 5.7);
        }
    }, 15000);

    function renderLoop() {
        requestAnimationFrame(renderLoop);
        frameCount++;
        
        if (visualizer) {
            visualizer.render();
        }
    }
    renderLoop();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
} else {
    start();
}
