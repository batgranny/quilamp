import butterchurn from 'butterchurn';
import butterchurnPresets from 'butterchurn-presets';

const canvas = document.getElementById('canvas');

let visualizer = null;
let presets = null;
let presetKeys = [];
let currentPresetIndex = 0;

let audioContext = null;
let analyser = null;
let scriptNode = null;

let lastAudioData = null;
let lastAudioTime = 0;
let frameCount = 0;
let isLocked = false;

// Trap global errors for console
window.onerror = (msg, url, line, col, error) => {
    console.error(`[Visualizer] JS Error: ${msg} (${line}:${col})`);
    return false;
};

function initAudioBridge() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;

        // Use a ScriptProcessor to inject audio data arriving via IPC
        scriptNode = audioContext.createScriptProcessor(1024, 0, 1);
        
        scriptNode.onaudioprocess = (e) => {
            const output = e.outputBuffer.getChannelData(0);
            if (lastAudioData && lastAudioData.timeData) {
                const data = lastAudioData.timeData;
                for (let i = 0; i < output.length; i++) {
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

        const gain = audioContext.createGain();
        gain.gain.value = 0; // Mute local output

        scriptNode.connect(analyser);
        analyser.connect(gain);
        gain.connect(audioContext.destination);

        return true;
    } catch (e) {
        console.error(`Audio Bridge Error: ${e.message}`);
        return false;
    }
}

async function start() {
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

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
        if (!visualizer) return;
        
        if (e.code === 'Space' || e.code === 'ArrowRight') {
            currentPresetIndex = (currentPresetIndex + 1) % presetKeys.length;
            visualizer.loadPreset(presets[presetKeys[currentPresetIndex]], 2.0);
        } else if (e.code === 'ArrowLeft') {
            currentPresetIndex = (currentPresetIndex - 1 + presetKeys.length) % presetKeys.length;
            visualizer.loadPreset(presets[presetKeys[currentPresetIndex]], 2.0);
        } else if (e.code === 'KeyL') {
            isLocked = !isLocked;
            console.log(`Preset rotation ${isLocked ? 'locked' : 'unlocked'}`);
        }
    });

    // Cycle presets
    setInterval(() => {
        if (visualizer && !isLocked) {
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
