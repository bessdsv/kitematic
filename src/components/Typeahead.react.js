'use strict';

import _ from 'underscore';
import React from 'react/addons';

const OnClickOutsideFactory = function (React) {
  "use strict";

  // Use a parallel array because we can't use
  // objects as keys, they get toString-coerced
  var registeredComponents = [];
  var handlers = [];

  var IGNORE_CLASS = 'ignore-react-onclickoutside';

  var isSourceFound = function(source, localNode) {
    if (source === localNode) {
      return true;
    }
    // SVG <use/> elements do not technically reside in the rendered DOM, so
    // they do not have classList directly, but they offer a link to their
    // corresponding element, which can have classList. This extra check is for
    // that case.
    // See: http://www.w3.org/TR/SVG11/struct.html#InterfaceSVGUseElement
    // Discussion: https://github.com/Pomax/react-onclickoutside/pull/17
    if (source.correspondingElement) {
      return source.correspondingElement.classList.contains(IGNORE_CLASS);
    }
    return source.classList.contains(IGNORE_CLASS);
  };

  return {
    componentDidMount: function() {
      if(typeof this.handleClickOutside !== "function")
        throw new Error("Component lacks a handleClickOutside(event) function for processing outside click events.");

      var fn = this.__outsideClickHandler = (function(localNode, eventHandler) {
        return function(evt) {
          evt.stopPropagation();
          var source = evt.target;
          var found = false;
          // If source=local then this event came from "somewhere"
          // inside and should be ignored. We could handle this with
          // a layered approach, too, but that requires going back to
          // thinking in terms of Dom node nesting, running counter
          // to React's "you shouldn't care about the DOM" philosophy.
          while(source.parentNode) {
            found = isSourceFound(source, localNode);
            if(found) return;
            source = source.parentNode;
          }
          eventHandler(evt);
        }
      }(React.findDOMNode(this), this.handleClickOutside));

      var pos = registeredComponents.length;
      registeredComponents.push(this);
      handlers[pos] = fn;

      // If there is a truthy disableOnClickOutside property for this
      // component, don't immediately start listening for outside events.
      if (!this.props.disableOnClickOutside) {
        this.enableOnClickOutside();
      }
    },

    componentWillUnmount: function() {
      this.disableOnClickOutside();
      this.__outsideClickHandler = false;
      var pos = registeredComponents.indexOf(this);
      if( pos>-1) {
        if (handlers[pos]) {
          // clean up so we don't leak memory
          handlers.splice(pos, 1);
          registeredComponents.splice(pos, 1);
        }
      }
    },

    /**
     * Can be called to explicitly enable event listening
     * for clicks and touches outside of this element.
     */
    enableOnClickOutside: function() {
      var fn = this.__outsideClickHandler;
      document.addEventListener("mousedown", fn);
      document.addEventListener("touchstart", fn);
    },

    /**
     * Can be called to explicitly disable event listening
     * for clicks and touches outside of this element.
     */
    disableOnClickOutside: function() {
      var fn = this.__outsideClickHandler;
      document.removeEventListener("mousedown", fn);
      document.removeEventListener("touchstart", fn);
    }
  };

};

const onClickOutside = OnClickOutsideFactory(React);

const MenuItem = React.createClass({
  displayName: 'MenuItem',

  componentWillReceiveProps(nextProps) {
    if (nextProps.active) {
      React.findDOMNode(this).firstChild.focus();
    }
  },

  render() {
    return (
        <li
            className={this.props.className + ( this.props.active ? ' active ': '') + (this.props.disabled ? ' disabled ': '')}>
          <a href="#" onClick={this._handleClick}>
            {this.props.children}
          </a>
        </li>
    );
  },

  _handleClick(e) {
    e.preventDefault();
    this.props.onClick && this.props.onClick();
  }
});

const TypeaheadMenu = React.createClass({
  displayName: 'TypeaheadMenu',

  getDefaultProps() {
    return {
      emptyLabel: 'No matches found.',
      maxHeight: 300,
    };
  },

  render() {
    const {maxHeight, options} = this.props;

    let items = options.length ?
        options.map(this._renderDropdownItem) :
        <MenuItem disabled className={this.props.className}>{this.props.emptyLabel}</MenuItem>;

    return (
        <ul
            style={{ maxHeight: maxHeight + 'px', right: 0 }}
            className={this.props.className + ' dropdown-menu'}>
          {items}
        </ul>
    );
  },

  _renderDropdownItem(option, idx) {
    const {activeIndex, onClick} = this.props;

    return (
        <MenuItem
            className={this.props.className}
            active={idx === activeIndex}
            key={idx}
            onClick={onClick.bind(null, option)}>
          {option[this.props.labelKey]}
        </MenuItem>
    );
  }
});

const TypeaheadInput = React.createClass({
  displayName: 'TypeaheadInput',

  mixins: [onClickOutside],

  render() {
    return (
        <div
            className={this.props.className + ' bootstrap-typeahead-input'}
            onClick={this._handleInputFocus}
            onFocus={this._handleInputFocus}
            tabIndex={0}>
          <input
              {...this.props}
              className={this.props.className + ' bootstrap-typeahead-input-main ' + (!this.props.selected ? 'has-selection': '')}
              onKeyDown={this._handleKeydown}
              ref="input"
              style={{
            backgroundColor: 'transparent',
            display: 'block',
            position: 'relative',
            zIndex: 1
          }}
              type="text"
              value={this._getInputValue()}
              />
          <input
              className={this.props.className + ' bootstrap-typeahead-input-hint '}
              style={{
            borderColor: 'transparent',
            bottom: 0,
            display: 'block',
            position: 'absolute',
            top: 0,
            width: '100%',
            zIndex: 0
          }}
              value={this._getHintText()}
              />
        </div>
    );
  },

  _getInputValue() {
    const {labelKey, selected, text} = this.props;
    return selected ? selected[labelKey] : text;
  },

  _getHintText() {
    const {filteredOptions, labelKey, text} = this.props;
    let firstOption = _.first(filteredOptions);

    // Only show the hint if...
    if (
        // ...the input is focused.
    React.findDOMNode(this.refs.input) === document.activeElement &&
      // ...the input contains text.
    text &&
      // ...the input text corresponds to the beginning of the first option.
    firstOption &&
    firstOption[labelKey].indexOf(text) === 0
    ) {
      return firstOption[labelKey];
    }
  },

  /**
   * If the containing parent div is focused or clicked, focus the input.
   */
  _handleInputFocus: function(e) {
    React.findDOMNode(this.refs.input).focus();
  },

  _handleKeydown: function(e) {
    const {filteredOptions, onAdd, onRemove, selected} = this.props;

    switch (e.keyCode) {
      case 27 :
        React.findDOMNode(this.refs.input).blur();
        break;
      case 39 :
        // Autocomplete the selection if there's a hint and no selection yet.
        if (this._getHintText() && !selected) {
          onAdd && onAdd(_.first(filteredOptions));
        }
        break;
      case 8 :
        // Remove the selection if we start deleting it.
        selected && onRemove && onRemove(selected);
        break;
    }

    this.props.onKeyDown && this.props.onKeyDown(e);
  },

  handleClickOutside: function(e) {
    // Force blur so that input is no longer the active element. For some
    // reason, it's taking 2 clicks to fully blur the input otherwise.
    React.findDOMNode(this.refs.input).blur();
  },
});

/**
 * Typeahead
 */
const Typeahead = React.createClass({
  displayName: 'Typeahead',

  mixins: [onClickOutside],

  getDefaultProps() {
    return {
      defaultSelected: [],
      labelKey: 'label',
      selected: []
    };
  },

  getInitialState() {
    const {defaultSelected, selected} = this.props;

    return {
      activeIndex: 0,
      selected: !_.isEmpty(defaultSelected) ? defaultSelected : selected,
      showMenu: false,
      text: ''
    };
  },

  componentWillReceiveProps(nextProps) {
    if (!_.isEqual(this.props.selected, nextProps.selected)) {
      // If new selections are passed in via props, treat the component as a
      // controlled input.
      this.setState({selected: nextProps.selected});
    }

  },

  render() {
    const {labelKey, options} = this.props;
    let {activeIndex, selected, text} = this.state;

    // Filter out options that don't match the input string or, if multiple
    // selections are allowed, that have already been selected.
    let filteredOptions = options.filter((option) => {
      return !(
        option[labelKey].toLowerCase().indexOf(text.toLowerCase()) === -1
      );
    });

    let menu;
    if (this.state.showMenu) {
      menu =
        <TypeaheadMenu
          className={this.props.className}
          activeIndex={activeIndex}
          emptyLabel={this.props.emptyLabel}
          labelKey={labelKey}
          maxHeight={this.props.maxHeight}
          onClick={this._handleAddOption}
          options={filteredOptions}
        />;
    }

    selected = _.first(selected);
    text = (selected && selected[labelKey]) || text;

    return (
      <div
        className={this.props.className + ' bootstrap-typeahead open'}
        style={{position: 'relative'}}>
        <TypeaheadInput
          className={this.props.className}
          filteredOptions={filteredOptions}
          labelKey={labelKey}
          onAdd={this._handleAddOption}
          onChange={this._handleTextChange}
          onFocus={this._handleFocus}
          onKeyDown={this._handleKeydown.bind(null, filteredOptions)}
          onRemove={this._handleRemoveOption}
          placeholder={this.props.placeholder}
          ref="input"
          selected={selected}
          text={text}
        />
        {menu}
      </div>
    );
  },

  _handleFocus() {
    this.setState({showMenu: true});
  },

  _handleTextChange(e) {
    this.setState({
      activeIndex: 0,
      showMenu: true,
      text: e.target.value
    });
  },

  _handleKeydown(options, e) {
    let {activeIndex} = this.state;

    switch (e.keyCode) {
      case 8 /*BACKSPACE*/:
        // Don't let the browser go back.
        e.stopPropagation();
        break;
      case 38 /*UP*/:
        // Prevent page from scrolling.
        e.preventDefault();

        activeIndex--;
        if (activeIndex < 0) {
          activeIndex = options.length - 1;
        }
        this.setState({activeIndex});
        break;
      case 40 /*DOWN*/:
      case 9 /*TAB*/:
        // Prevent page from scrolling.
        e.preventDefault();

        activeIndex++;
        if (activeIndex === options.length) {
          activeIndex = 0;
        }
        this.setState({activeIndex});
        break;
      case 27 /*ESC*/:
        // Prevent things like unintentionally closing dialogs.
        e.stopPropagation();
        this._hideDropdown();
        break;
      case 13 /*RETURN*/:
        let selected = options[activeIndex];
        selected && this._handleAddOption(selected);
        break;
    }
  },

  _handleAddOption(selectedOption) {
    const {labelKey, onChange} = this.props;

    let selected;
    let text;

    // If only a single selection is allowed, replace the existing selection
    // with the new one.
    selected = [selectedOption];
    text = selectedOption[labelKey];

    this.setState({
      activeIndex: 0,
      selected,
      showMenu: false,
      text
    });

    onChange && onChange(selected);
  },

  _handleRemoveOption(removedOption) {
    let selected = this.state.selected.slice();
    selected = selected.filter((option) => !_.isEqual(option, removedOption));

    this.setState({
      activeIndex: 0,
      selected,
      showMenu: false
    });

    this.props.onChange && this.props.onChange(selected);
  },

  /**
   * From `onClickOutside` mixin.
   */
  handleClickOutside(e) {
    this._hideDropdown();
  },

  _hideDropdown() {
    this.setState({
      activeIndex: 0,
      showMenu: false
    });
  }
});

export default Typeahead;
