define(function (require) {
	
	// Dependencies
	var $ = require('jquery')
		, _ = require('lodash')
		, Backbone = require('backbone')
		, tooltip = require('admin/vendor/bootstrap/js/tooltip')
		, $doc = $(document)
		, editor_pad = 2 // Editor padding + borders 
		, icon_tpl = '<span class="decoy-el-icon"><span class="decoy-el-mask"></span><span class="glyphicon glyphicon-pencil"></span></span>'
		, icon_size = 20 // The initial size of the icon, both width and height
		, tween_length = 200 // How long the tween lasts
	;

	// Get a reference to the Bootstrap Tooltip class
	var Tooltip = $.fn.tooltip.Constructor;

	// Subclass Tooltip to so methods can be overriden without affecting anything
	// else using Tooltipls for it's intended purpose
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create
	var Icon = function() { Tooltip.apply(this, arguments); };
	Icon.prototype = Object.create(Tooltip.prototype);
	Icon.prototype.constructor = Icon;

	// Tweak defaults
	Icon.prototype.getDefaults = function() {
		var defaults = Tooltip.DEFAULTS;
		defaults.placement = 'auto';
		defaults.animation = false; // Don't add the Bootstrap animation class
		defaults.template = icon_tpl; // Replace template with our own
		defaults.trigger = 'manual'; // We're going to open them only via API
		return defaults;
	};

	// Bypass the check for content, these icon's don't have titles.
	Icon.prototype.hasContent = function() {
		return true;
	};

	// Remember the initial placement
	Icon.prototype.applyPlacement = function(offset, placement) {
		if (!this.placement) this.placement = placement;
		Tooltip.prototype.applyPlacement.apply(this, arguments);
	};

	// Setup view
	var View = {};
	View.initialize = function() {
		_.bindAll(this);

		// Render the element icon 
		this.icon = this.create();
		this.$icon = this.icon.tip();
		this.icon.show();
		this.$icon.addClass('decoy-el-init');

		// Cache
		this.open = false;
		this.$mask = this.$icon.find('.decoy-el-mask');
		this.key = this.$el.data('decoy-el');
		this.$glyph = this.$icon.find('.glyphicon');

		// Events
		this.$icon.on('click', this.load);
		window.addEventListener('message', this.onPostMessage, false);

	};

	// Create an Element editable icon
	View.create = function() {
		return new Icon(this.el);
	};

	// Load the editor
	View.load = function(e) {

		// Disable double clicks
		if (this.open) return;
		this.open = true;

		// Close on any click outside of it
		$doc.on('click', this.closeIfOutside);
				
		// Build an iframe that will render the element field editor
		this.spin();
		this.$iframe = $('<iframe>').appendTo(this.$mask).attr({
			src: '/admin/elements/field/'+this.key
		});

	};

	// Show the spinner
	View.spin = function() {
		this.$glyph.addClass('glyphicon-refresh').removeClass('glyphicon-pencil');
	};

	// Remove spinner
	View.stopSpin = function() {
		this.$glyph.addClass('glyphicon-pencil').removeClass('glyphicon-refresh');
	};

	// Handle iframe messages
	View.onPostMessage = function(e) {

		// Reject messages for other icons
		if (e.data.key != this.key) return;

		// Delegate different types of messages
		switch (e.data.type) {
			case 'height': return this.reveal(e.data.value + editor_pad);
			case 'saving': return this.saving();
			case 'saved': return this.saved(e.data.value);
			case 'close': return this.close();
		}
	};

	// Reveal the editor
	View.reveal = function(height) {

		// Remove the spinnner after transition is complete
		_.delay(this.stopSpin, tween_length);

		// Resize and reposition elements
		var iframe_width = this.$iframe.width();
		this.$icon.addClass('decoy-el-open')
		this.$iframe.css({ height: height });
		this.$mask.addClass('decoy-el-show').css({ width: iframe_width, height: height });
		this.reposition(iframe_width, height);
	};

	// Re apply position using inerhitted code
	View.reposition = function(w, h) {
		this.icon.applyPlacement(
			this.icon.getCalculatedOffset(this.icon.placement, this.icon.getPosition(), w, h), 
		this.icon.placement);
	};

	// Put the editor in a pending state because the user has submitted
	// the iframe form. 
	View.saving = function() {
		this.$mask.removeClass('decoy-el-show');
		this.spin();
	};

	// The iframe has finished saving, so update the DOM with the new value
	// and then close it
	View.saved = function(value) {
		this.updateDOM(value);
		this.close();
	}

	// Close on click outside of the editor
	View.closeIfOutside = function(e) {
		if (!this.$icon.is(e.target) && !this.$icon.has(e.target).length) {
			this.close();
		}
	};

	// Close the editor
	View.close = function(e) {

		// Resize and reposition elements back to close state
		this.$icon.removeClass('decoy-el-open');
		this.$mask.removeClass('decoy-el-show').css({ width: '', height: ''});
		this.reposition(icon_size, icon_size);

		// Remove the iframe and spinner (if it's still out there) from DOM
		this.$iframe.off('load', this.close);
		_.delay(function(self) { self.$iframe.remove(); }, tween_length, this);
		this.stopSpin();

		// Remove mouse listeners
		$doc.off('click', this.closeIfOutside);

		// Allow opening again
		this.open = false;
	};

	// Live update the DOM with the change the user made
	View.updateDOM = function(value) {

		// If an image tag, put the value in the source
		if (this.$el.is('img')) this.$el.attr('src', value);

		// If this is an "a" tag and the key looks like a link, put it in href
		else if (this.$el.is('a') && /(link|url|file|pdf)$/.test(this.key)) this.$el.attr('href', value);

		// If the element has a style tag with a background and the key looks like 
		// an image, set it as the background image
		else if (this.$el.is('[style*="background"]') && /(image|background|marquee)$/.test(this.key))
			this.$el.css('background-image', 'url("'+value+'")');

		// Otherwise, the default behavior is to replace the text of the el
		else this.$el.html(value);

	};
	
	// Return view class
	return Backbone.View.extend(View);
});