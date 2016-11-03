/**
 * @fileoverview TooltipBase is base class of tooltip components.
 * @author NHN Ent.
 *         FE Development Lab <dl_javascript@nhnent.com>
 */

'use strict';

var chartConst = require('../../const/'),
    dom = require('../../helpers/domHandler'),
    predicate = require('../../helpers/predicate'),
    renderUtil = require('../../helpers/renderUtil');

var TooltipBase = tui.util.defineClass(/** @lends TooltipBase.prototype */ {
    /**
     * TooltipBase is base class of tooltip components.
     * @constructs TooltipBase
     * @param {object} params - parameters
     *      @param {string} params.chartType - chart type
     *      @param {DataProcessor} params.dataProcessor - DataProcessor instance
     *      @param {object} params.options - tooltip options
     *      @param {object} params.theme - tooltip theme
     *      @param {boolean} params.isVertical - whether vertical or not
     *      @param {object} params.public event - tui.util.CustomEvent instance
     *      @param {object} params.labelTheme - theme for label
     *      @param {string} params.xAxisType - xAxis type
     *      @param {string} params.dateFormat - date format
     */
    init: function(params) {
        var isPieChart = predicate.isPieChart(params.chartType);

        /**
         * Chart type
         * @type {string}
         */
        this.chartType = params.chartType;

        /**
         * Data processor
         * @type {DataProcessor}
         */
        this.dataProcessor = params.dataProcessor;

        /**
         * Options
         * @type {object}
         */
        this.options = params.options;

        /**
         * Theme
         * @type {object}
         */
        this.theme = params.theme;

        /**
         * whether vertical or not
         * @type {boolean}
         */
        this.isVertical = params.isVertical;

        /**
         * event bus for transmitting message
         * @type {object}
         */
        this.eventBus = params.eventBus;

        /**
         * label theme
         * @type {object}
         */
        this.labelTheme = params.labelTheme;

        /**
         * x axis type
         * @type {?string}
         */
        this.xAxisType = params.xAxisType;

        /**
         * dateFormat option for xAxis
         * @type {?string}
         */
        this.dateFormat = params.dateFormat;

        /**
         * className
         * @type {string}
         */
        this.className = 'tui-chart-tooltip-area';

        /**
         * Tooltip container.
         * @type {HTMLElement}
         */
        this.tooltipContainer = null;

        /**
         * Tooltip suffix.
         * @type {string}
         */
        this.suffix = this.options.suffix ? '&nbsp;' + this.options.suffix : '';

        /**
         * Tooltip template function.
         * @type {function}
         */
        this.templateFunc = this.options.template || tui.util.bind(this._makeTooltipHtml, this);

        /**
         * Tooltip animation time.
         * @type {number}
         */
        this.animationTime = isPieChart ? chartConst.TOOLTIP_PIE_ANIMATION_TIME : chartConst.TOOLTIP_ANIMATION_TIME;

        /**
         * TooltipBase base data.
         * @type {Array.<Array.<object>>}
         */
        this.data = [];

        /**
         * layout bounds information for this components
         * @type {null|{dimension:{width:number, height:number}, position:{left:number, top:number}}}
         */
        this.layout = null;

        /**
         * dimension map for layout of chart
         * @type {null|object}
         */
        this.dimensionMap = null;

        this._setDefaultTooltipPositionOption();
        this._saveOriginalPositionOptions();

        this._attachToEventBus();
    },

    /**
     * Attach to event bus.
     * @private
     */
    _attachToEventBus: function() {
        this.eventBus.on({
            showTooltip: this.onShowTooltip,
            hideTooltip: this.onHideTooltip
        }, this);

        if (this.onShowTooltipContainer) {
            this.eventBus.on({
                showTooltipContainer: this.onShowTooltipContainer,
                hideTooltipContainer: this.onHideTooltipContainer
            }, this);
        }
    },

    /**
     * Make tooltip html.
     * @private
     * @abstract
     */
    _makeTooltipHtml: function() {},

    /**
     * Set default align option of tooltip.
     * @private
     * @abstract
     */
    _setDefaultTooltipPositionOption: function() {},

    /**
     * Save position options.
     * @private
     */
    _saveOriginalPositionOptions: function() {
        this.orgPositionOptions = {
            align: this.options.align,
            offset: this.options.offset
        };
    },

    /**
     * Make tooltip data.
     * @private
     * @abstract
     */
    _makeTooltipData: function() {},

    /**
     * Set data for rendering.
     * @param {{
     *      layout: {
     *          dimension: {width: number, height: number},
     *          position: {left: number, top: number}
     *      },
     *      dimensionMap: object
     * }} data - bounds data
     * @private
     */
    _setDataForRendering: function(data) {
        this.layout = data.layout;
        this.dimensionMap = data.dimensionMap;
    },

    /**
     * Render tooltip component.
     * @param {object} data - bounds data
     * @returns {HTMLElement} tooltip element
     */
    render: function(data) {
        var el = dom.create('DIV', this.className);

        this._setDataForRendering(data);
        this.data = this._makeTooltipData();

        renderUtil.renderPosition(el, this.layout.position);

        this.tooltipContainer = el;

        return el;
    },

    /**
     * Rerender.
     * @param {object} data - bounds data
     */
    rerender: function(data) {
        this.resize(data);
        this.data = this._makeTooltipData();
    },

    /**
     * Resize tooltip component.
     * @param {object} data - bounds data
     * @override
     */
    resize: function(data) {
        this._setDataForRendering(data);

        renderUtil.renderPosition(this.tooltipContainer, this.layout.position);
        if (this.positionModel) {
            this.positionModel.updateBound(this.layout);
        }
    },

    /**
     * Zoom.
     */
    zoom: function() {
        this.data = this._makeTooltipData();
    },

    /**
     * Get tooltip element.
     * @returns {HTMLElement} tooltip element
     * @private
     */
    _getTooltipElement: function() {
        var tooltipElement;

        if (!this.tooltipElement) {
            this.tooltipElement = tooltipElement = dom.create('DIV', 'tui-chart-tooltip');
            dom.append(this.tooltipContainer, tooltipElement);
        }

        return this.tooltipElement;
    },

    /**
     * onShowTooltip is callback of custom event showTooltip for SeriesView.
     * @param {object} params coordinate event parameters
     */
    onShowTooltip: function(params) {
        var tooltipElement = this._getTooltipElement();
        var isScatterCombo = predicate.isComboChart(this.chartType) && predicate.isScatterChart(params.chartType);
        var prevPosition;

        if ((!predicate.isMousePositionChart(params.chartType) || isScatterCombo) && tooltipElement.offsetWidth) {
            prevPosition = {
                left: tooltipElement.offsetLeft,
                top: tooltipElement.offsetTop
            };
        }

        this._showTooltip(tooltipElement, params, prevPosition);
    },

    /**
     * Get tooltip dimension
     * @param {HTMLElement} tooltipElement tooltip element
     * @returns {{width: number, height: number}} rendered tooltip dimension
     */
    getTooltipDimension: function(tooltipElement) {
        return {
            width: tooltipElement.offsetWidth,
            height: tooltipElement.offsetHeight
        };
    },

    /**
     * Move to Position.
     * @param {HTMLElement} tooltipElement tooltip element
     * @param {{left: number, top: number}} position position
     * @param {{left: number, top: number}} prevPosition prev position
     * @private
     */
    _moveToPosition: function(tooltipElement, position, prevPosition) {
        if (prevPosition) {
            this._slideTooltip(tooltipElement, prevPosition, position);
        } else {
            renderUtil.renderPosition(tooltipElement, position);
        }
    },

    /**
     * Slide tooltip
     * @param {HTMLElement} tooltipElement tooltip element
     * @param {{left: number, top: number}} prevPosition prev position
     * @param {{left: number, top: number}} position position
     * @private
     */
    _slideTooltip: function(tooltipElement, prevPosition, position) {
        var moveTop = position.top - prevPosition.top,
            moveLeft = position.left - prevPosition.left;

        renderUtil.cancelAnimation(this.slidingAnimation);

        this.slidingAnimation = renderUtil.startAnimation(this.animationTime, function(ratio) {
            var left = moveLeft * ratio,
                top = moveTop * ratio;
            tooltipElement.style.left = (prevPosition.left + left) + 'px';
            tooltipElement.style.top = (prevPosition.top + top) + 'px';
        });
    },

    /**
     * onHideTooltip is callback of custom event hideTooltip for SeriesView
     * @param {number} index index
     */
    onHideTooltip: function(index) {
        var tooltipElement = this._getTooltipElement();

        this._hideTooltip(tooltipElement, index);
    },

    /**
     * Set align option.
     * @param {string} align align
     */
    setAlign: function(align) {
        this.options.align = align;
        if (this.positionModel) {
            this.positionModel.updateOptions(this.options);
        }
    },

    /**
     * Update offset option.
     * @param {{x: number, y: number}} offset - offset
     * @private
     */
    _updateOffsetOption: function(offset) {
        this.options.offset = offset;

        if (this.positionModel) {
            this.positionModel.updateOptions(this.options);
        }
    },

    /**
     * Set offset.
     * @param {{x: number, y: number}} offset - offset
     */
    setOffset: function(offset) {
        var offsetOption = tui.util.extend({}, this.options.offset);

        if (tui.util.isExisty(offset.x)) {
            offsetOption.x = offset.x;
        }

        if (tui.util.isExisty(offset.y)) {
            offsetOption.y = offset.y;
        }

        this._updateOffsetOption(tui.util.extend({}, this.options.offset, offsetOption));
    },

    /**
     * Set position option.
     * @param {{left: number, top: number}} position moving position
     * @deprecated
     */
    setPosition: function(position) {
        var offsetOption = tui.util.extend({}, this.options.offset);

        if (tui.util.isExisty(position.left)) {
            offsetOption.x = position.left;
        }

        if (tui.util.isExisty(position.top)) {
            offsetOption.y = position.y;
        }

        this._updateOffsetOption(offsetOption);
    },

    /**
     * Reset align option.
     */
    resetAlign: function() {
        var align = this.orgPositionOptions.align;

        this.options.align = align;

        if (this.positionModel) {
            this.positionModel.updateOptions(this.options);
        }
    },

    /**
     * Reset offset option.
     */
    resetOffset: function() {
        this.options.offset = this.orgPositionOptions.offset;
        this._updateOffsetOption(this.options.offset);
    }
});

module.exports = TooltipBase;