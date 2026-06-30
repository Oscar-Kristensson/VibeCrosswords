/**
 * serialiser.js – save the current crossword to a downloadable .json file,
 * and load a previously saved .json file back into state.
 */
'use strict';

const Serialiser = (() => {

  function save(filename = 'crossword.json') {
    const json = State.toJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function load(file, onDone) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        State.fromJSON(e.target.result);
        if (onDone) onDone(true);
      } catch (err) {
        console.error('Failed to parse crossword JSON', err);
        if (onDone) onDone(false, err);
      }
    };
    reader.onerror = () => { if (onDone) onDone(false); };
    reader.readAsText(file);
  }

  return { save, load };
})();
