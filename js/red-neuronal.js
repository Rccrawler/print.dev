(() => {
  const canvas = document.getElementById('decisionCanvas');
  const lossCanvas = document.getElementById('lossCanvas');
  const status = document.getElementById('neuralStatus');
  const trainButton = document.getElementById('trainNetwork');
  const engineLabel = document.getElementById('neuralEngine');
  const points = [];
  const losses = [];
  let model;
  let trainingInputs;
  let trainingLabels;
  let selectedClass = 0;
  let isTraining = false;
  let stopRequested = false;
  let currentLoss = null;
  let activeStatusKey = 'neural_status_loading';
  let activeStatusValues = {};
  const totalEpochs = 160;

  function translate(key, values = {}) {
    let text = window.i18n?.t(key) || key;
    Object.entries(values).forEach(([name, value]) => {
      text = text.replace(`{${name}}`, value);
    });
    return text;
  }

  function setStatus(key, values) {
    activeStatusKey = key;
    activeStatusValues = values || {};
    status.textContent = translate(key, values);
  }

  document.addEventListener('languageChanged', () => {
    setStatus(activeStatusKey, activeStatusValues);
    if (isTraining) trainButton.textContent = translate('neural_stop');
  });

  setStatus(activeStatusKey);

  function generatePoints() {
    points.length = 0;
    const aspectRatio = canvas.clientWidth / canvas.clientHeight || 1;
    for (let index = 0; index < 56; index++) {
      const angle = Math.random() * Math.PI * 2;
      const innerRadius = Math.sqrt(Math.random()) * 0.19;
      const outerRadius = 0.37 + (Math.random() - 0.5) * 0.07;
      points.push({
        x: 0.5 + Math.cos(angle) * innerRadius / aspectRatio,
        y: 0.5 + Math.sin(angle) * innerRadius,
        label: 0
      });
      points.push({
        x: 0.5 + Math.cos(angle) * outerRadius / aspectRatio,
        y: 0.5 + Math.sin(angle) * outerRadius,
        label: 1
      });
    }
    refreshDataset();
  }

  function refreshDataset() {
    if (trainingInputs) trainingInputs.dispose();
    if (trainingLabels) trainingLabels.dispose();
    trainingInputs = null;
    trainingLabels = null;
    if (points.length) {
      trainingInputs = tf.tensor2d(points.map(point => [point.x, point.y]));
      trainingLabels = tf.tensor2d(points.map(point => [point.label]));
    }
    updateCounts();
    drawDecision();
  }

  function updateCounts() {
    document.getElementById('redCount').textContent = points.filter(point => point.label === 0).length;
    document.getElementById('blueCount').textContent = points.filter(point => point.label === 1).length;
  }

  function resizeCanvas(target, context) {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, target.clientWidth);
    const height = Math.max(1, target.clientHeight);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (target.width !== pixelWidth || target.height !== pixelHeight) {
      target.width = pixelWidth;
      target.height = pixelHeight;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width, height };
  }

  function drawDecision() {
    if (!canvas || !window.tf) return;
    const context = canvas.getContext('2d');
    const { width, height } = resizeCanvas(canvas, context);
    context.clearRect(0, 0, width, height);

    if (model) {
      const gridWidth = Math.max(35, Math.round(width / 6));
      const gridHeight = Math.max(28, Math.round(height / 6));
      const coordinates = new Float32Array(gridWidth * gridHeight * 2);
      for (let row = 0; row < gridHeight; row++) {
        for (let column = 0; column < gridWidth; column++) {
          const offset = (row * gridWidth + column) * 2;
          coordinates[offset] = (column + 0.5) / gridWidth;
          coordinates[offset + 1] = 1 - (row + 0.5) / gridHeight;
        }
      }
      const prediction = tf.tidy(() => model.predict(tf.tensor2d(coordinates, [gridWidth * gridHeight, 2])).dataSync());
      const heat = document.createElement('canvas');
      heat.width = gridWidth;
      heat.height = gridHeight;
      const heatContext = heat.getContext('2d');
      const image = heatContext.createImageData(gridWidth, gridHeight);
      for (let index = 0; index < prediction.length; index++) {
        const probability = prediction[index];
        const strength = Math.abs(probability - 0.5) * 1.2;
        const red = probability < 0.5;
        const color = red ? [222, 107, 97] : [65, 134, 198];
        const pixel = index * 4;
        image.data[pixel] = Math.round(248 + (color[0] - 248) * strength);
        image.data[pixel + 1] = Math.round(247 + (color[1] - 247) * strength);
        image.data[pixel + 2] = Math.round(243 + (color[2] - 243) * strength);
        image.data[pixel + 3] = 255;
      }
      heatContext.putImageData(image, 0, 0);
      context.imageSmoothingEnabled = true;
      context.drawImage(heat, 0, 0, width, height);
    } else {
      context.fillStyle = '#f6f5f1';
      context.fillRect(0, 0, width, height);
    }

    points.forEach(point => {
      context.beginPath();
      context.arc(point.x * width, (1 - point.y) * height, 4.5, 0, Math.PI * 2);
      context.fillStyle = point.label === 0 ? '#dc6b61' : '#4186c6';
      context.fill();
      context.lineWidth = 1.5;
      context.strokeStyle = '#ffffff';
      context.stroke();
    });
  }

  function drawLoss() {
    const context = lossCanvas.getContext('2d');
    const { width, height } = resizeCanvas(lossCanvas, context);
    context.clearRect(0, 0, width, height);
    context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
    context.lineWidth = 1;
    for (let row = 1; row < 4; row++) {
      const y = Math.round((height * row) / 4) + 0.5;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    if (losses.length < 2) return;

    const visibleLosses = losses.slice(-100);
    const maximum = Math.max(...visibleLosses, 0.05);
    context.beginPath();
    visibleLosses.forEach((loss, index) => {
      const x = (index / Math.max(1, visibleLosses.length - 1)) * width;
      const y = height - 8 - (loss / maximum) * (height - 16);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = '#42b883';
    context.lineWidth = 2;
    context.stroke();
  }

  function resetModel() {
    if (model) model.dispose();
    model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [2], units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 12, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });
    model.compile({ optimizer: tf.train.adam(0.025), loss: 'binaryCrossentropy' });
    losses.length = 0;
    currentLoss = null;
    document.getElementById('epochValue').textContent = '0';
    document.getElementById('lossValue').textContent = '—';
    drawLoss();
    drawDecision();
  }

  function setControlsDisabled(disabled) {
    document.getElementById('selectRed').disabled = disabled;
    document.getElementById('selectBlue').disabled = disabled;
    document.getElementById('randomizePoints').disabled = disabled;
    document.getElementById('clearPoints').disabled = disabled;
  }

  async function train() {
    if (isTraining) {
      stopRequested = true;
      return;
    }
    if (!points.some(point => point.label === 0) || !points.some(point => point.label === 1)) {
      setStatus('neural_status_empty');
      return;
    }

    isTraining = true;
    stopRequested = false;
    trainButton.textContent = translate('neural_stop');
    setControlsDisabled(true);
    try {
      if (!model) resetModel();
      await model.fit(trainingInputs, trainingLabels, {
        epochs: totalEpochs,
        batchSize: 24,
        shuffle: true,
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            currentLoss = logs.loss;
            losses.push(currentLoss);
            document.getElementById('epochValue').textContent = epoch + 1;
            document.getElementById('lossValue').textContent = currentLoss.toFixed(3);
            drawLoss();
            drawDecision();
            setStatus('neural_status_training', { epoch: epoch + 1, total: totalEpochs, loss: currentLoss.toFixed(3) });
            if (stopRequested) model.stopTraining = true;
            await new Promise(resolve => requestAnimationFrame(resolve));
          }
        }
      });
      setStatus(stopRequested ? 'neural_status_stopped' : 'neural_status_trained', { loss: (currentLoss ?? 0).toFixed(3) });
    } catch (error) {
      setStatus('neural_status_error');
      console.error('Error entrenando la red neuronal:', error);
    } finally {
      isTraining = false;
      trainButton.textContent = translate('neural_train');
      setControlsDisabled(false);
    }
  }

  function selectClass(label) {
    selectedClass = label;
    document.getElementById('selectRed').setAttribute('aria-pressed', String(label === 0));
    document.getElementById('selectBlue').setAttribute('aria-pressed', String(label === 1));
  }

  function clearPoints() {
    points.length = 0;
    if (model) resetModel();
    refreshDataset();
    setStatus('neural_status_empty');
  }

  document.getElementById('selectRed').addEventListener('click', () => selectClass(0));
  document.getElementById('selectBlue').addEventListener('click', () => selectClass(1));
  document.getElementById('randomizePoints').addEventListener('click', () => {
    resetModel();
    generatePoints();
    setStatus('neural_status_ready', { backend: tf.getBackend() });
  });
  document.getElementById('clearPoints').addEventListener('click', clearPoints);
  trainButton.addEventListener('click', train);
  canvas.addEventListener('click', event => {
    if (isTraining) return;
    const bounds = canvas.getBoundingClientRect();
    points.push({
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: 1 - Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
      label: selectedClass
    });
    refreshDataset();
    if (model) setStatus('neural_status_ready', { backend: tf.getBackend() });
  });
  window.addEventListener('resize', () => {
    drawDecision();
    drawLoss();
  });

  window.addEventListener('load', async () => {
    if (!window.tf) {
      setStatus('neural_status_error');
      engineLabel.dataset.ready = 'false';
      return;
    }
    try {
      await tf.ready();
      resetModel();
      generatePoints();
      setControlsDisabled(false);
      trainButton.disabled = false;
      engineLabel.dataset.ready = 'true';
      engineLabel.textContent = `TensorFlow.js · ${tf.getBackend()}`;
      setStatus('neural_status_ready', { backend: tf.getBackend() });
    } catch (error) {
      setStatus('neural_status_error');
      console.error('Error iniciando TensorFlow.js:', error);
    }
  }, { once: true });
})();