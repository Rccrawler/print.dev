(() => {
  const promptInput = document.getElementById('textPrompt');
  const corpusInput = document.getElementById('trainingCorpus');
  const predictionList = document.getElementById('predictionList');
  const contextFlow = document.getElementById('tokenFlow');
  const completionPreview = document.getElementById('completionPreview');
  const modelStatus = document.getElementById('modelStatus');
  const matchStatus = document.getElementById('matchStatus');
  const networkStatus = document.getElementById('networkStatus');
  const runTrainingButton = document.getElementById('runTraining');
  const maxContext = 3;
  const transitions = [new Map(), new Map(), new Map(), new Map()];
  const demoCorpora = {
    es: [
      'La programación permite crear herramientas útiles para resolver problemas reales.',
      'La programación permite automatizar tareas repetitivas y ahorrar tiempo.',
      'La práctica permite mejorar con paciencia.',
      'Una buena rutina permite avanzar paso a paso.',
      'Programar ayuda a transformar ideas en soluciones concretas.',
      'Un buen algoritmo organiza los datos y produce resultados claros.',
      'El código limpio facilita el trabajo en equipo y reduce los errores.',
      'Las pruebas detectan errores antes de publicar una aplicación.',
      'Una interfaz sencilla ayuda a las personas a completar sus tareas.',
      'La inteligencia artificial aprende patrones a partir de muchos ejemplos.',
      'Un modelo de lenguaje predice la siguiente palabra según el contexto.',
      'Los datos locales permanecen en el navegador y no se envían al servidor.',
      'Aprender programación requiere práctica, curiosidad y constancia.',
      'Las herramientas digitales simplifican el trabajo de los desarrolladores.',
      'La programación permite crear software para resolver problemas reales.',
      'El código claro facilita el mantenimiento de una aplicación.'
    ].join('\n'),
    en: [
      'Programming allows developers to build useful tools that solve real problems.',
      'Programming allows teams to build useful tools.',
      'Programming helps automate repetitive tasks and save time.',
      'Practice allows people to improve with patience.',
      'A good routine allows teams to make steady progress.',
      'Writing code turns ideas into practical solutions.',
      'Good algorithms organize data and produce clear results.',
      'Clean code improves teamwork and reduces errors.',
      'Tests find bugs before an application is released.',
      'A simple interface helps people finish their tasks.',
      'Artificial intelligence learns patterns from many examples.',
      'A language model predicts the next word from context.',
      'Local data stays in the browser and is not sent to a server.',
      'Learning to code takes practice, curiosity, and patience.',
      'Digital tools simplify everyday work for developers.',
      'Programming allows teams to build software for real problems.',
      'Readable code makes an application easier to maintain.'
    ].join('\n')
  };
  const demoPrompts = {
    es: 'La programación permite',
    en: 'Programming allows'
  };
  let currentLanguage = 'es';
  let selectedContext = 3;
  let currentSuggestions = [];
  let learnedCorpus = '';
  const defaultArchitecture = [16, 8];
  let architecture = [...defaultArchitecture];
  let networkModel = null;
  let networkVocabulary = [];
  let vocabularyIndex = new Map();
  let modelIsDirty = true;
  let isTraining = false;
  let stopRequested = false;
  let latestAccuracy = null;
  let activeNetworkStatus = 'text_predictor_model_loading';
  let activeNetworkStatusValues = {};

  function translate(key, values = {}) {
    let text = window.i18n?.t(key) || key;
    Object.entries(values).forEach(([name, value]) => {
      text = text.replace(`{${name}}`, value);
    });
    return text;
  }

  function setNetworkStatus(key, values = {}) {
    activeNetworkStatus = key;
    activeNetworkStatusValues = values;
    networkStatus.textContent = translate(key, values);
  }

  document.addEventListener('languageChanged', () => {
    setNetworkStatus(activeNetworkStatus, activeNetworkStatusValues);
    if (isTraining) runTrainingButton.textContent = translate('text_predictor_stop_model');
  });

  function tokenize(text) {
    return text.toLocaleLowerCase(currentLanguage).match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [];
  }

  function addTransition(contextSize, context, nextWord) {
    let choices = transitions[contextSize].get(context);
    if (!choices) {
      choices = new Map();
      transitions[contextSize].set(context, choices);
    }
    choices.set(nextWord, (choices.get(nextWord) || 0) + 1);
  }

  function buildNgramModel() {
    transitions.forEach(table => table.clear());
    learnedCorpus = corpusInput.value.trim();
    const words = tokenize(learnedCorpus);

    words.forEach((word, position) => {
      for (let contextSize = 0; contextSize <= 3 && contextSize <= position; contextSize++) {
        const context = contextSize ? words.slice(position - contextSize, position).join(' ') : '';
        addTransition(contextSize, context, word);
      }
    });

    const sentenceCount = learnedCorpus.match(/[.!?]+/g)?.length || learnedCorpus.split(/\n+/).filter(Boolean).length;
    document.getElementById('vocabCount').textContent = new Set(words).size;
    document.getElementById('phraseCount').textContent = sentenceCount;
    modelStatus.textContent = translate('text_predictor_status', {
      vocab: new Set(words).size,
      sentences: sentenceCount
    });
    renderArchitecture();
    renderPredictions();
  }

  function findSuggestions(words) {
    for (let contextSize = Math.min(selectedContext, words.length); contextSize >= 0; contextSize--) {
      const context = contextSize ? words.slice(-contextSize).join(' ') : '';
      const choices = transitions[contextSize].get(context);
      if (choices?.size) {
        const total = [...choices.values()].reduce((sum, count) => sum + count, 0);
        const suggestions = [...choices.entries()]
          .map(([word, count]) => ({ word, probability: count / total }))
          .sort((first, second) => second.probability - first.probability || first.word.localeCompare(second.word, currentLanguage))
          .slice(0, 5);
        return { suggestions, contextSize };
      }
    }
    return { suggestions: [], contextSize: 0 };
  }

  function encodeContext(words, contextSize = selectedContext) {
    const encoded = new Float32Array(maxContext * networkVocabulary.length);
    const contextWords = words.slice(-contextSize);
    contextWords.forEach((word, index) => {
      const wordIndex = vocabularyIndex.get(word);
      if (wordIndex === undefined) return;
      const slot = maxContext - contextWords.length + index;
      encoded[slot * networkVocabulary.length + wordIndex] = 1;
    });
    return encoded;
  }

  function findNetworkSuggestions(words) {
    if (!networkModel || modelIsDirty || !networkVocabulary.length || !words.length) return null;
    const probabilities = tf.tidy(() => networkModel.predict(
      tf.tensor2d(encodeContext(words), [1, maxContext * networkVocabulary.length])
    ).dataSync());
    const suggestions = [...probabilities.entries()]
      .map(([index, probability]) => ({ word: networkVocabulary[index], probability }))
      .sort((first, second) => second.probability - first.probability)
      .slice(0, 5);
    return { suggestions, contextSize: Math.min(selectedContext, words.length) };
  }

  function renderFlow(words, matchedContextSize) {
    contextFlow.replaceChildren();
    const visibleWords = words.slice(-Math.max(selectedContext, 1));
    visibleWords.forEach((word, index) => {
      const token = document.createElement('span');
      token.className = `predictor-token${index >= visibleWords.length - matchedContextSize && matchedContextSize ? ' is-context' : ''}`;
      token.textContent = word;
      contextFlow.append(token);
    });
    if (currentSuggestions.length) {
      const arrow = document.createElement('span');
      arrow.className = 'predictor-flow-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';
      const nextToken = document.createElement('span');
      nextToken.className = 'predictor-token is-next';
      nextToken.textContent = currentSuggestions[0].word;
      contextFlow.append(arrow, nextToken);
    }
  }

  function renderPreview() {
    completionPreview.replaceChildren();
    const text = promptInput.value.trim();
    completionPreview.append(document.createTextNode(text));
    if (text && currentSuggestions.length) {
      completionPreview.append(document.createTextNode(' '));
      const nextWord = document.createElement('span');
      nextWord.className = 'predictor-preview-next';
      nextWord.textContent = currentSuggestions[0].word;
      completionPreview.append(nextWord);
    }
  }

  function renderPredictionList() {
    predictionList.replaceChildren();
    if (!currentSuggestions.length) {
      const empty = document.createElement('p');
      empty.className = 'predictor-empty';
      empty.textContent = promptInput.value.trim() ? translate('text_predictor_no_results') : translate('text_predictor_empty');
      predictionList.append(empty);
      return;
    }

    currentSuggestions.forEach((suggestion, index) => {
      const button = document.createElement('button');
      button.className = 'predictor-suggestion';
      button.type = 'button';
      button.setAttribute('aria-label', translate('text_predictor_insert', { word: suggestion.word }));

      const rank = document.createElement('span');
      rank.className = 'predictor-rank';
      rank.textContent = String(index + 1).padStart(2, '0');
      const word = document.createElement('span');
      word.className = 'predictor-word';
      word.textContent = suggestion.word;
      const percentage = document.createElement('span');
      percentage.className = 'predictor-percent';
      percentage.textContent = `${Math.round(suggestion.probability * 100)}%`;
      const track = document.createElement('span');
      track.className = 'predictor-score-track';
      const fill = document.createElement('span');
      fill.className = 'predictor-score-fill';
      fill.style.setProperty('--score', `${suggestion.probability * 100}%`);
      track.append(fill);
      button.append(rank, word, percentage, track);
      button.addEventListener('click', () => insertSuggestion(suggestion.word));
      predictionList.append(button);
    });
  }

  function renderPredictions() {
    const words = tokenize(promptInput.value);
    const networkResult = findNetworkSuggestions(words);
    const result = networkResult || findSuggestions(words);
    currentSuggestions = result.suggestions;
    document.getElementById('matchedOrder').textContent = translate(networkResult ? 'text_predictor_mode_neural' : 'text_predictor_mode_baseline');
    const matchedUnit = result.contextSize === 1 ? translate('text_predictor_word') : translate('text_predictor_words');
    matchStatus.textContent = result.contextSize
      ? translate('text_predictor_match', { count: result.contextSize, unit: matchedUnit })
      : words.length ? translate('text_predictor_match_global') : '';
    renderFlow(words, result.contextSize);
    renderPreview();
    renderPredictionList();
  }

  function insertSuggestion(word) {
    const text = promptInput.value.trimEnd();
    promptInput.value = text ? `${text} ${word}` : word;
    promptInput.focus();
    promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
    renderPredictions();
  }

  function setContextSize(size) {
    selectedContext = size;
    document.querySelectorAll('[data-context]').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.context) === size));
    });
    renderPredictions();
  }

  function renderArchitecture() {
    const diagram = document.getElementById('architectureDiagram');
    if (!diagram) return;
    diagram.replaceChildren();
    const vocabSize = Number(document.getElementById('vocabCount').textContent) || networkVocabulary.length;
    const layers = [
      { name: translate('text_predictor_input_layer'), size: maxContext, className: 'is-input' },
      ...architecture.map(size => ({ name: translate('text_predictor_hidden_layer'), size, className: 'is-hidden' })),
      { name: translate('text_predictor_output_layer'), size: vocabSize, className: 'is-output' }
    ];

    layers.forEach((layer, layerIndex) => {
      const column = document.createElement('div');
      column.className = `predictor-network-layer ${layer.className}`;
      const name = document.createElement('span');
      name.className = 'predictor-layer-name';
      name.textContent = layer.name;
      const stack = document.createElement('span');
      stack.className = 'predictor-neuron-stack';
      const visibleNodes = Math.min(layer.size, layer.className === 'is-hidden' ? 7 : 5);
      for (let index = 0; index < visibleNodes; index++) {
        const neuron = document.createElement('span');
        neuron.className = 'predictor-neuron';
        stack.append(neuron);
      }
      if (layer.size > visibleNodes) {
        const more = document.createElement('span');
        more.className = 'predictor-neuron-more';
        more.textContent = '...';
        stack.append(more);
      }
      const size = document.createElement('span');
      size.className = 'predictor-layer-size';
      size.textContent = layer.className === 'is-input' ? `${maxContext} × ${vocabSize || 'V'}` : layer.size;
      column.append(name, stack, size);
      diagram.append(column);
      if (layerIndex < layers.length - 1) {
        const connector = document.createElement('span');
        connector.className = 'predictor-network-connector';
        connector.setAttribute('aria-hidden', 'true');
        connector.textContent = '→';
        diagram.append(connector);
      }
    });

    document.getElementById('architectureStats').textContent = translate('text_predictor_arch_stats', {
      layers: architecture.length,
      neurons: architecture.reduce((total, size) => total + size, 0)
    });
    document.getElementById('addNeuron').disabled = isTraining || architecture.at(-1) >= 64;
    document.getElementById('addLayer').disabled = isTraining || architecture.length >= 4;
    document.getElementById('resetArchitecture').disabled = isTraining || architecture.join(',') === defaultArchitecture.join(',');
  }

  function prepareTrainingData() {
    const sentences = learnedCorpus.split(/[.!?\n]+/).map(tokenize).filter(words => words.length > 1);
    networkVocabulary = [...new Set(sentences.flat())];
    vocabularyIndex = new Map(networkVocabulary.map((word, index) => [word, index]));
    const inputs = [];
    const labels = [];
    sentences.forEach(words => {
      for (let position = 1; position < words.length; position++) {
        for (let contextSize = 1; contextSize <= maxContext; contextSize++) {
          const context = words.slice(Math.max(0, position - contextSize), position);
          inputs.push(Array.from(encodeContext(context, contextSize)));
          const target = new Float32Array(networkVocabulary.length);
          target[vocabularyIndex.get(words[position])] = 1;
          labels.push(Array.from(target));
        }
      }
    });
    renderArchitecture();
    return { inputs, labels, vocabularySize: networkVocabulary.length };
  }

  function createNetwork(vocabularySize) {
    const model = tf.sequential();
    architecture.forEach((units, index) => {
      const layerOptions = { units, activation: 'relu' };
      if (index === 0) layerOptions.inputShape = [maxContext * vocabularySize];
      model.add(tf.layers.dense(layerOptions));
    });
    model.add(tf.layers.dense({ units: vocabularySize, activation: 'softmax' }));
    model.compile({ optimizer: tf.train.adam(0.01), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
    return model;
  }

  function updateMetrics(accuracy, loss, baseline) {
    document.getElementById('networkAccuracy').textContent = `${(accuracy * 100).toFixed(1)}%`;
    document.getElementById('networkLoss').textContent = Number(loss).toFixed(3);
    const delta = baseline === null ? null : (accuracy - baseline) * 100;
    document.getElementById('accuracyDelta').textContent = delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pp`;
  }

  function setTrainingControlsDisabled(disabled) {
    document.getElementById('addNeuron').disabled = disabled || architecture.at(-1) >= 64;
    document.getElementById('addLayer').disabled = disabled || architecture.length >= 4;
    document.getElementById('resetArchitecture').disabled = disabled || architecture.join(',') === defaultArchitecture.join(',');
    corpusInput.disabled = disabled;
    document.getElementById('resetCorpus').disabled = disabled;
  }

  async function trainNetwork() {
    if (isTraining) {
      stopRequested = true;
      return;
    }
    if (!window.tf) {
      setNetworkStatus('text_predictor_model_error');
      return;
    }
    const trainingData = prepareTrainingData();
    if (trainingData.inputs.length < 3 || trainingData.vocabularySize < 2) {
      setNetworkStatus('text_predictor_model_empty');
      return;
    }

    isTraining = true;
    stopRequested = false;
    const baseline = latestAccuracy;
    const previousModel = networkModel;
    let inputs;
    let labels;
    let currentAccuracy = 0;
    try {
      networkModel = createNetwork(trainingData.vocabularySize);
      modelIsDirty = false;
      previousModel?.dispose();
      inputs = tf.tensor2d(trainingData.inputs, [trainingData.inputs.length, maxContext * trainingData.vocabularySize]);
      labels = tf.tensor2d(trainingData.labels, [trainingData.labels.length, trainingData.vocabularySize]);
      setTrainingControlsDisabled(true);
      runTrainingButton.textContent = translate('text_predictor_stop_model');
      document.getElementById('trainingProgress').value = 0;

      await networkModel.fit(inputs, labels, {
        epochs: 80,
        batchSize: 32,
        shuffle: true,
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            currentAccuracy = logs.acc ?? logs.accuracy ?? logs.categoricalAccuracy ?? 0;
            updateMetrics(currentAccuracy, logs.loss, baseline);
            document.getElementById('trainingProgress').value = ((epoch + 1) / 80) * 100;
            setNetworkStatus('text_predictor_model_training', {
              epoch: epoch + 1,
              total: 80,
              accuracy: `${(currentAccuracy * 100).toFixed(1)}%`
            });
            renderPredictions();
            if (stopRequested) networkModel.stopTraining = true;
            await new Promise(resolve => window.setTimeout(resolve, 0));
          }
        }
      });

      latestAccuracy = currentAccuracy;
      setNetworkStatus(stopRequested ? 'text_predictor_model_stopped' : 'text_predictor_model_trained', {
        accuracy: `${(currentAccuracy * 100).toFixed(1)}%`,
        loss: document.getElementById('networkLoss').textContent
      });
    } catch (error) {
      networkModel?.dispose();
      networkModel = null;
      modelIsDirty = true;
      setNetworkStatus('text_predictor_model_error');
      console.error('Error entrenando el predictor de texto:', error);
      renderPredictions();
    } finally {
      inputs?.dispose();
      labels?.dispose();
      isTraining = false;
      runTrainingButton.textContent = translate('text_predictor_train_model');
      setTrainingControlsDisabled(false);
      renderArchitecture();
    }
  }

  function setArchitectureDirty() {
    modelIsDirty = true;
    setNetworkStatus('text_predictor_model_dirty');
    renderArchitecture();
    renderPredictions();
  }

  function restoreDemo() {
    const language = window.i18n?.getLanguage() || 'es';
    corpusInput.value = demoCorpora[language];
    promptInput.value = demoPrompts[language];
    latestAccuracy = null;
    networkModel?.dispose();
    networkModel = null;
    modelIsDirty = true;
    buildNgramModel();
    setNetworkStatus('text_predictor_model_ready', { backend: window.tf?.getBackend() || 'CPU' });
  }

  document.querySelectorAll('[data-context]').forEach(button => {
    button.addEventListener('click', () => setContextSize(Number(button.dataset.context)));
  });
  promptInput.addEventListener('input', renderPredictions);
  runTrainingButton.addEventListener('click', trainNetwork);
  document.getElementById('resetCorpus').addEventListener('click', restoreDemo);
  document.getElementById('addNeuron').addEventListener('click', () => {
    if (architecture.at(-1) < 64) architecture[architecture.length - 1]++;
    setArchitectureDirty();
  });
  document.getElementById('addLayer').addEventListener('click', () => {
    if (architecture.length < 4) architecture.push(8);
    setArchitectureDirty();
  });
  document.getElementById('resetArchitecture').addEventListener('click', () => {
    architecture = [...defaultArchitecture];
    setArchitectureDirty();
  });
  corpusInput.addEventListener('input', () => {
    latestAccuracy = null;
    networkModel?.dispose();
    networkModel = null;
    modelIsDirty = true;
    buildNgramModel();
    setNetworkStatus('text_predictor_model_dirty');
  });
  promptInput.addEventListener('keydown', event => {
    if (event.key === 'Tab' && currentSuggestions.length) {
      event.preventDefault();
      insertSuggestion(currentSuggestions[0].word);
    }
  });

  document.addEventListener('languageChanged', event => {
    const previousLanguage = currentLanguage;
    currentLanguage = event.detail?.lang || window.i18n?.getLanguage() || 'es';
    if (corpusInput.value.trim() === demoCorpora[previousLanguage]) {
      corpusInput.value = demoCorpora[currentLanguage];
    }
    if (promptInput.value.trim() === demoPrompts[previousLanguage]) {
      promptInput.value = demoPrompts[currentLanguage];
    }
    latestAccuracy = null;
    networkModel?.dispose();
    networkModel = null;
    modelIsDirty = true;
    buildNgramModel();
    setNetworkStatus('text_predictor_model_ready', { backend: window.tf?.getBackend() || 'CPU' });
  });

  function initialize() {
    currentLanguage = window.i18n?.getLanguage() || 'es';
    corpusInput.value = demoCorpora[currentLanguage];
    promptInput.value = demoPrompts[currentLanguage];
    buildNgramModel();
    renderArchitecture();
    setNetworkStatus('text_predictor_model_loading');
    if (!window.tf) {
      setNetworkStatus('text_predictor_model_error');
      return;
    }
    tf.ready().then(() => {
      ['runTraining', 'addNeuron', 'addLayer', 'resetArchitecture'].forEach(id => {
        document.getElementById(id).disabled = false;
      });
      setNetworkStatus('text_predictor_model_ready', { backend: tf.getBackend() });
    }).catch(error => {
      setNetworkStatus('text_predictor_model_error');
      console.error('Error iniciando TensorFlow.js:', error);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();