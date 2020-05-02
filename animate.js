(function (root, factory) {
  if (typeof exports === 'object') {
    module.exports = factory(root);
  } else if (typeof define === 'function' && define.amd) {
    define('animate', [], function () {
      return factory(root);
    });
  } else {
    root.Animate = factory(root);
  }
}(this, function(window, undefined) {
  'use strict';

  // TODO: use ids instead of element in buffers; stop,... styles only

  var Animate = function(options) {
      this.options = {
        ease: function(n) {return -(--n*n*n*n-1)}, // --n*n*n+1
        speed: 0.25,
        animationEndCallback: function(element){},
      };

      _init(this, options || {});
    },
    _init = function(_this, options) {
      for (var option in options) { // extend options
        _this.options[option] = options[option];
      }
    },
    _animate = window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame || function(cb) {
        window.setTimeout(cb, 16);
      },
    _buffer = [],
    _pauseBuffer = [];


  Animate.prototype = {
    queue: function(element, styles, speed, cbs, ease) {
      return this.animate(element, styles, speed, cbs, ease, true);
    },
    animate: function(element, styles, speed, cbs, ease, queue) { // id?
      var previous = this.stopAnimation(element); // TODO: check

      if (previous) {
        previous.endCallback.call(this, previous.element);
      }
      _buffer.push({
        element: element,
        elementStyle: element.style,
        timeIsUp: false,
        data: {
          startTime: new Date().getTime(),
          styles : sizzleCSS(styles.replace(/;\s*$/, '').split(/\s*;\s*/g)),
          updateCallbacks: cbs && cbs.updateCallbacks,
          speed: (speed !== undefined ? speed : this.options.speed) * 1000,
          ease: ease || this.options.ease
        },
        endCallback: cbs && cbs.endCallback || this.options.animationEndCallback,
      });

      return queue ? this : triggerRendering(this);
    },
    getElementState: function(element) {
      return (findBufferItem(element, _buffer) || {}).item;
    },
    pauseAnimation: function(element) { // TODO: use style parameter
      var bufferItem = removeItem(element, _buffer);

      if (bufferItem) {
        _pauseBuffer.push(bufferItem);
      }

      return triggerRendering(this);
    },
    resetAnimation: function(element) { // TODO: use style parameter
      var bufferItem = removeItem(element, _pauseBuffer);

      if (bufferItem) {
        bufferItem.data.startTime = // tweak time to continue
          new Date().getTime() - bufferItem.elapsedTime;
        _buffer.push(bufferItem);
      }

      return triggerRendering(this);
    },
    stopAnimation: function(element, _this, endCallback) { // TODO: parameter
      var bufferItem = removeItem(element, _buffer);

      removeItem(element, _pauseBuffer);
      triggerRendering(this);

      return bufferItem;
    },
    destroy: function() {
      // TODO
    }
  };

  function removeItem(element, buffer) {
    var bufferItem = findBufferItem(element, buffer);

    if (bufferItem) {
      return buffer.splice(bufferItem.index, 1)[0];
    }
  }

  function triggerRendering(_this) {
    if (!_this.isAnimating && _buffer.length) {
      _this.isAnimating = true;
      render(_this, _buffer);
    } else if (!_buffer.length) {
      _this.isAnimating = false;
    }

    return _this;
  }

  function findBufferItem(element, buffer) {
    for (var n = buffer.length; n--; ) {
      if (buffer[n].element === element) {
        return {
          item: buffer[n],
          index: n
        }
      }
    }
  }

  function render(_this, buffer) {
    var time = new Date().getTime(),
      elapsedTime = 0,
      ease = 0;

    for (var n = buffer.length; n--; ) { // pre-render
      if (buffer[n].timeIsUp) {
        buffer.splice(n, 1); // preserve for backwards animation??
        _this.isAnimating = !!buffer.length;
        continue;
      }
      elapsedTime = time - buffer[n].data.startTime; // inside preRender?
      buffer[n].timeIsUp = elapsedTime >= buffer[n].data.speed;
      ease = buffer[n].timeIsUp ? 1 : // TODO: maybe sync with others
        buffer[n].data.ease(elapsedTime / buffer[n].data.speed);
      buffer[n].preRender = preRender(buffer[n].data, ease);
      buffer[n].elapsedTime = elapsedTime;
    }

    // fastest possible rendering as there is no further calculations
    // in between Element.style declarations
    for (var n = 0, l = buffer.length; n < l; n++) { // render
      for (var style in buffer[n].preRender) _render(buffer[n], style);
    }

    buffer.length && _animate(function() { // call again
      render(_this, buffer);
    });

    for (var n = 0, l = buffer.length; n < l; n++) { // endCallback
      buffer[n].timeIsUp &&
        buffer[n].endCallback.call(_this, buffer[n].element);
    }
  }

  function _render(_buffer, style) { // v8 opt.
    _buffer.elementStyle[style] = _buffer.preRender[style];
  }

  function preRender(data, ease) {
    var values = [],
      css = {}; // String is fater than Array.push().join()

    for (var style in data.styles) _preRender(style, data, ease, values, css);

    return css;
  }

  function _preRender(style, data, ease, values, css) { // v8 opt.
    values = data.styles[style];
    css[style] = '';
    for (var n = 0, len = values.length; n < len; n++) {
      if (typeof values[n] === 'string') {
        css[style] += values[n];
        // delete data.styles[style]; // only once; faster
      } else {
        if(values[n].hasCB) {
          values[n].delta =
            data.updateCallbacks[values[n].hasCB]() - values[n].start;
        }
        css[style] += round(values[n].start + values[n].delta * ease,
          values[n].doRound) + values[n].unit;
      }
    }
  }

  function sizzleCSS(styles) {
    var style = '',
      output = {},
      fragments = [],
      css = [];

    for (var n = styles.length; n--; ) {
      fragments = [];
      style = styles[n]
        .replace(/\s*(\)|\(|,|:|->|=>)\s*/g, '$1')
        .split(':');
      css = style[1].replace(/([.0-9]+[^,\s)]*(?:-|=)>.*?)([\s,)])/g,
        function($1, $2, $3) {
          fragments.push(extractValues($2));
          return '||' + $3;
        }).split('||');

      if (css.length === 1) {
        fragments.push(extractValues(css[0]));
      } else {
        for (var x = 0, xl = css.length; x < xl; x++) {
          fragments.splice(x * 2, 0, css[x])
        }
      }
      output[style[0].replace(/-(.)/g, function($1, $2) {
        return $2.toUpperCase();
      })] = fragments;
    }

    return output;
  }

  function extractValues(value) {
    var doRound = value.indexOf('=>') !== -1,
      val = value.split(/(?:-|=)>/),
      unit = val[0].replace(/[0-9.-]/g, ''),
      hasCB = false;

    if (!val[1]) {
      return value;
    }

    hasCB = val[1].split('fn|')[1];
    val[0] = +val[0] || parseInt(val[0]);
    val[1] = +val[1] || parseInt(val[1]);

    return {
      start: val[0],
      delta: val[1] >= 0 || val[1] < 0 ? val[1] - val[0] : 0,
      unit: unit,
      doRound: doRound,
      hasCB: hasCB,
    };
  }

  function round(value, doRound) {
    return doRound ? Math.round(value) : value;
  }

  return Animate;
}));
