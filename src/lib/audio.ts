export async function mixAudio(voiceChunks: Float32Array[], backgroundWav: Uint8Array | null): Promise<Blob> {
  // Combine all voice chunks into a single Float32Array
  const totalVoiceLen = voiceChunks.reduce((acc, val) => acc + val.length, 0);
  const fullVoice = new Float32Array(totalVoiceLen);
  let offset = 0;
  for (const chunk of voiceChunks) {
    fullVoice.set(chunk, offset);
    offset += chunk.length;
  }

  const actx = new OfflineAudioContext(2, Math.max(fullVoice.length, 1), 24000);

  // --- Voice Buffer ---
  const voiceBuffer = actx.createBuffer(1, fullVoice.length, 24000);
  voiceBuffer.copyToChannel(fullVoice, 0);
  
  const voiceSource = actx.createBufferSource();
  voiceSource.buffer = voiceBuffer;

  // Add slight spatial processing (3D panner or just reverb) to voice
  const panner = actx.createPanner();
  panner.panningModel = 'HRTF';
  panner.positionX.value = 0;
  panner.positionY.value = 0;
  panner.positionZ.value = -1; // slightly in front

  const voiceGain = actx.createGain();
  voiceGain.gain.value = 1.0;

  voiceSource.connect(panner);
  panner.connect(voiceGain);
  voiceGain.connect(actx.destination);

  voiceSource.start(0);

  // --- Background Buffer (Lyria) ---
  if (backgroundWav && backgroundWav.length > 0) {
    try {
      const bgBuffer = await actx.decodeAudioData(backgroundWav.buffer.slice(0)); 
      // If we have a background, loop it if it's shorter than the voice piece
      const bgSource = actx.createBufferSource();
      bgSource.buffer = bgBuffer;
      bgSource.loop = true;
      
      const bgGain = actx.createGain();
      bgGain.gain.value = 0.25; // Subtle background

      bgSource.connect(bgGain);
      bgGain.connect(actx.destination);
      bgSource.start(0);
      
      // Since Lyria returns its own native samplerate, decodeAudioData handles resampling!
      
      // Update OfflineAudioContext length to the maximum of voice or background (we just use voice length as the actual length because it's narration)
    } catch(err) {
      console.warn("Failed to decode Lyria background wav", err);
    }
  }

  // Render
  const renderedBuffer = await actx.startRendering();
  return audioBufferToWav(renderedBuffer);
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);

  const channels = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let sample = 0;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit
  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true); // little endian
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
