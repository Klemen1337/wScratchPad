class wScratchPad {
  constructor(el, options) {
    this.$el = el;
    this.options = options;

    this.defaults = {
      size        : 30,          // The size of the brush/scratch.
      fg          : '#ccc',  // Foreground (image path or hex color).
      realtime    : true,       // Calculates percentage in realitime
      scratchDown : null,       // Set scratchDown callback.
      scratchUp   : null,       // Set scratchUp callback.
      scratchMove : null,       // Set scratcMove callback.
      cursor      : 'crosshair' // Set cursor.
    };

    this.options = Object.assign(this.defaults, this.options);

    this.init = false;
    this.enabled = true;

    this._generate();
  }
  
  _generate () {
    // Throw message if canvas is not supported.
    if (!document.createElement('canvas').getContext) {
      this.$el.innerHTML = 'Canvas is not supported in this browser.';
      return;
    }

    // Setup canvas and context.
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');

    // Make sure it's at least relative.
    this.$el.style.position = 'relative';

    // Create image element
    this.$img = document.createElement('img');
    this.$img.style.position = 'absolute';
    this.$img.style.width = '100%';
    this.$img.style.height = '100%';
    this.$img.crossOrigin = '';


    // Make sure we set style width height here for elastic stretch
    // and better support for mobile if we are resizing the scratch pad.
    // this.$scratchpad = $(this.canvas).css({position: 'absolute', width: '100%', height: '100%'});
    this.canvas.style.position = 'absolute';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.$scratchpad = this.canvas;
    

    // Bind mobile events
    this._bindMobileEvents(this.$scratchpad);


    // Setup event handlers.
    var that = this;
    this.$scratchpad.addEventListener('mousedown', function (e) {
      // If disabled we just return true which menas
      // our our this.scratch will remain as false.
      if (!that.enabled) {
        return;
      }

      var rect = that.canvas.getBoundingClientRect();
      that.canvasOffset ={
        top: rect.top + document.body.scrollTop,
        left: rect.left + document.body.scrollLeft
      };
      
      that.scratch = that;
      that._scratchFunc(e, 'Down');
    });

    this.$scratchpad.addEventListener('mousemove', function (e) {
      if (that.scratch) {
        that._scratchFunc(e, 'Move');
      }
    });

    document.addEventListener('mouseup', function (e) {
      if (that.scratch) {
        that.scratch = false;
        that._scratchFunc(e, 'Up');
      }
    });

    // Run options
    this._setOptions();

    // Append items
    // this.$el.appendChild(this.$img);
    this.$el.appendChild(this.$scratchpad);

    // Initialize and reset
    this.init = true;
    this.reset();
  }

  reset () {
    var _this = this,
        width = Math.ceil(this.$el.offsetWidth),
        height = Math.ceil(this.$el.offsetHeight),
        devicePixelRatio = window.devicePixelRatio || 1;

    // Set number of pixels required for getting scratch percentage.
    this.pixels = width * height;

    // We'll do a hard reset for the height here in case
    // we need to run this at differnt sizes.
    this.$scratchpad.style.width = width;
    this.$scratchpad.style.height = height;

    this.canvas.setAttribute('width', width * devicePixelRatio);
    this.canvas.setAttribute('height', height * devicePixelRatio);
    this.ctx.scale(devicePixelRatio, devicePixelRatio);

    this.pixels = width * devicePixelRatio * height * devicePixelRatio;

    // Default to image hidden in case no bg or color is set.
    this.$img.style.display = 'none';

    // Set bg.
    if (this.options.bg) {
      if (this.options.bg.charAt(0) === '#') {
        this.$el.style.backgroundColor = this.options.bg;
      }
      else {
        this.$el.style.backgroundColor = null;
        this.$img.src = this.options.bg;
      }
    }

    // Set fg.
    if (this.options.fg) {
      if (this.options.fg.charAt(0) === '#') {
        this.ctx.fillStyle = this.options.fg;
        this.ctx.beginPath();
        this.ctx.rect(0, 0, width, height);
        this.ctx.fill();
        this.$img.style.display = 'block';
      } else {
        // Have to load image before we can use it.
        let image = new Image();
        image.addEventListener('load', function () {
          _this.ctx.drawImage(this, 0, 0, width, height);
          _this.$img.style.display = 'block';
        });
        image.addEventListener('error', function (e) {
          _this.ctx.fillStyle = "#ccc";
          _this.ctx.beginPath();
          _this.ctx.rect(0, 0, width, height);
          _this.ctx.fill();
          _this.$img.style.display = 'block';
        })
        image.src = this.options.fg;
        image.crossOrigin = '';
      }
    }
  }

  clear () {
    this.ctx.clearRect(0, 0, Math.ceil(this.$el.offsetWidth), Math.ceil(this.$el.offsetHeight));
  }

  enable (enabled) {
    this.enabled = enabled === true ? true : false;
  }

  destroy () {
    this.$el.empty();
    this.removeData(this.$el, 'wScratchPad');
  }

  _setOptions () {
    var opt, func;

    for (opt in this.options) {
      this.options[opt] = this.$el.getAttribute('data-' + opt) || this.options[opt];
      func = 'set' + opt.charAt(0).toUpperCase() + opt.substring(1);

      if (this[func]) {
        this[func](this.options[opt]);
      }
    }
  }

  setBg () {
    if (this.init) {
      this.reset();
    }
  }

  setFg () {
    this.setBg();
  }

  setCursor (cursor) {
    this.$el.style.cursor = cursor;
  }

  _scratchFunc (e, event) {
    let newE = Object.assign({}, e);
    newE.pageX = Math.floor(e.pageX - this.canvasOffset.left);
    newE.pageY = Math.floor(e.pageY - this.canvasOffset.top);
    
    this['_scratch' + event](newE);
    
    if (this.options.realtime || event === 'Move') {
      if (this.options['scratch' + event]) {
        this.options['scratch' + event].apply(this, [newE, this._scratchPercent()]);
      }
    }
  }

  _scratchPercent () {
    var hits = 0;
    var imageData = this.ctx.getImageData(0,0, this.canvas.width, this.canvas.height);
    
    for (var i=0, ii=imageData.data.length; i<ii; i=i+4) {
      if (imageData.data[i] === 0 && imageData.data[i+1] === 0 && imageData.data[i+2] === 0 && imageData.data[i+3] === 0) {
        hits++;
      }
    }
    
    return (hits / this.pixels) * 100;
  }

  _scratchDown (e) {
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.strokeStyle = this.options.color;
    this.ctx.lineWidth = this.options.size;
    
    //draw single dot in case of a click without a move
    this.ctx.beginPath();
    this.ctx.arc(e.pageX, e.pageY, this.options.size/2, 0, Math.PI*2, true);
    this.ctx.closePath();
    this.ctx.fill();
    
    //start the path for a drag
    this.ctx.beginPath();
    this.ctx.moveTo(e.pageX, e.pageY);
  }
  
  _scratchMove (e) {
    this.ctx.lineTo(e.pageX, e.pageY);
    this.ctx.stroke();
  }
  
  _scratchUp () {
    this.ctx.closePath();
  }

  _bindMobileEvents (element) {
    let that = this;
    element.addEventListener('touchstart', function (e) { that._handleMobile(e); });
    element.addEventListener('touchmove', function (e) { that._handleMobile(e); });
    element.addEventListener('touchend', function (e) { that._handleMobile(e); });
    element.addEventListener('touchcancel', function (e) { that._handleMobile(e); });
  }

  _handleMobile (event) {
      var touches = (event.changedTouches || event.originalEvent.targetTouches);
      var first = touches[0];
      var type = '';
  
      switch (event.type) {
        case 'touchstart':
          event.preventDefault();
          type = 'mousedown';
          break;
        case 'touchmove':
          type = 'mousemove';
          event.preventDefault();
          break;
        case 'touchend':
          type = 'mouseup';
          break;
        default:
          return;
      }
  
      var simulatedEvent = document.createEvent('MouseEvent'); 
  
      simulatedEvent.initMouseEvent(
        type, true, true, window, 1, 
        first.screenX, first.screenY, first.clientX, first.clientY, 
        false, false, false, false, 0/*left*/, null
      );
  
      first.target.dispatchEvent(simulatedEvent);
    }
}