import * as maptalks from 'maptalks';

const options = {
    lineSymbol: {
        lineColor: '#fff'
    },
    scaleColor: 'red',
    rotateColor: 'blue',
    translateColor: 'green',
    heightColor: '#2577E3',
    highLightColor: 'yellow',
    opacity: 0.4,
    panelSize: 300
};
const HIGH_LIGHT = 'highlight';
const HTMLTEMPLATE = `
<div class="model-control">
<svg t="1692767562378" viewBox="0 0 100 100" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5999"
    width="100%" height="100%" xmlns:xlink="http://www.w3.org/1999/xlink">
    <circle cx="50" cy="50" r="46" stroke="{scaleColor}" fill="transparent" stroke-width="5" stroke-dasharray="36,36" id='model-control-scale' />
    <circle cx="50" cy="50" r="46" stroke="{highLightColor}" fill="transparent" stroke-width="5" stroke-dasharray="36,36" id='model-control-scale-${HIGH_LIGHT}' style='display:none;pointer-events: none;'/>
    <circle cx="50" cy="50" r="35" stroke="{rotateColor}" fill="transparent" stroke-width="5" stroke-dasharray="0,0" id='model-control-rotation' />
    <circle cx="50" cy="50" r="35" stroke="{highLightColor}" fill="transparent" stroke-width="5" stroke-dasharray="0,0" id='model-control-rotation-${HIGH_LIGHT}' style='display:none;pointer-events: none;' />
    <circle cx="50" cy="50" r="20" stroke="{heightColor}" fill="transparent" stroke-width="5" stroke-dasharray="0,0" id='model-control-height' />
    <circle cx="50" cy="50" r="20" stroke="{highLightColor}" fill="transparent" stroke-width="5" stroke-dasharray="0,0" id='model-control-height-${HIGH_LIGHT}' style='display:none;pointer-events: none;' />
    <circle cx="50" cy="50" r="8" fill="{translateColor}" id='model-control-translate' />
    <circle cx="50" cy="50" r="8" fill="{highLightColor}" id='model-control-translate-${HIGH_LIGHT}' style='display:none;pointer-events: none;' />
</svg>
</div>
`;

function formatTemplate(options) {
    return maptalks.Util.replaceVariable(HTMLTEMPLATE, options);
}

function getDxDyRad(dxdy, bearing) {
    if (!dxdy) {
        return 0;
    }
    const { x, y } = dxdy;
    if (x === 0 && y === 0) {
        return 0;
    }
    if (x === 0 || !x) {
        if (y < 0) {
            return -Math.PI / 2;
        }
        if (y > 0) {
            return 0;
        }
    }

    const tan = y / x;
    let rad = Math.atan(tan);
    const PI = Math.PI;
    if (y < 0 && x > 0) {
        rad = Math.abs(rad) + PI / 2;
    }
    if (y > 0 && x > 0) {
        rad = PI / 2 - rad;
    }
    if (y > 0 && x < 0) {
        rad = Math.abs(rad) - PI / 2;
    }
    if (y < 0 && x < 0) {
        rad = -rad - PI / 2;
    }
    // console.log(rad / Math.PI * 180);
    return rad - bearing / 180 * PI;

}

function mapConfig(map, value) {
    map.config('zoomable', value);
    map.config('draggable', value);
}

function domShow(dom) {
    if (dom) {
        dom.style.display = 'block';
    }
}

function domHide(dom) {
    if (dom) {
        dom.style.display = 'none';
    }
}

const MOUSE_MOVE_EVENT = 'mousemove';
const MOUSE_ENTER_EVENT = 'mouseenter';
const MOUSE_LEAVE_EVENT = 'mouseleave';
const MOUSE_DOWN_EVENT = 'mousedown';
const MOUSE_UP_EVENT = 'mouseup';

const SCALE = 'scale';
const TRANSLATE = 'translate';
const ROTATION = 'rotation';
const HEIGHT = 'height';

export class ModelControl extends maptalks.Eventable(maptalks.Class) {
    constructor(map, options = {}) {
        super(options);
        this.map = map;
        this.model = null;
        this.uiMarker = null;
        this.layer = new maptalks.VectorLayer('___layer___', {
            geometryEvents: false,
            hitDetect: false,
            zIndex: 1000,
            enableAltitude: true
        });
        this._enable = false;
        this._isDown = false;
        this.operateModel = '';
        this.orginScale = 1;
        this._tempScale = null;
        this.height = 0;
        this._tempHeight = null;
        this._mousedownPoint = null;
        this.highLightDoms = [];
    }

    setOriginalScale(scale) {
        if (maptalks.Util.isNumber(scale)) {
            this.orginScale = scale;
        }
        return this;
    }

    enable() {
        if (!this.model) {
            console.warn('not find model data,please setModel(model)');
            return this;
        }
        if (this._enable) {
            return this;
        }
        this._enable = true;
        this.map.off(MOUSE_MOVE_EVENT, this._mouseMove, this);
        this.map.off(MOUSE_UP_EVENT, this._mouseUp, this);
        this.map.off(MOUSE_DOWN_EVENT, this._mouseDown, this);
        this.map.on(MOUSE_MOVE_EVENT, this._mouseMove, this);
        this.map.on(MOUSE_UP_EVENT, this._mouseUp, this);
        this.map.on(MOUSE_DOWN_EVENT, this._mouseDown, this);
        this._createMarker();
        this.layer.addTo(this.map);
        return this;
    }

    disable() {
        this.map.off(MOUSE_MOVE_EVENT, this._mouseMove, this);
        this.map.off(MOUSE_UP_EVENT, this._mouseUp, this);
        this.map.off(MOUSE_DOWN_EVENT, this._mouseDown, this);
        if (this.uiMarker) {
            this.uiMarker.remove();
        }
        this.uiMarker = null;
        this.highLightDoms = [];
        this._mousedownPoint = null;
        this._enable = false;
        this.layer.clear();
        this.layer.remove();
        return this;
    }

    setModel(model) {
        if (model.getCoordinates && model.on) {
            this.model = model;
            this.disable();
        } else {
            console.error(model, 'is error ,only support Geometry');
        }
        return this;
    }

    setTarget(model) {
        return this.setModel(model);
    }

    _createMarker() {
        if (this.uiMarker) {
            return this;
        }
        const coordinate = this.model.getCoordinates();
        const height = coordinate.z || 0;
        this.height = height;
        const marker = new maptalks.ui.UIMarker(coordinate, {
            content: formatTemplate(this.options),
            pitchWithMap: true
        });
        this.uiMarker = marker;
        const markerShowEnd = () => {
            this._setMarkerSize();
            marker.off('showend', markerShowEnd);
            this._bindDomEvents();
        };
        marker.on('showend', markerShowEnd);
        marker.addTo(this.map);
        return this;
    }

    _setMarkerSize(panelSize) {
        const dom = this.uiMarker.getDOM();
        if (!dom) {
            return this;
        }
        const { opacity } = this.options;
        panelSize = panelSize || this.options.panelSize;
        dom.style.width = `${panelSize}px`;
        dom.style.height = `${panelSize}px`;
        dom.style.opacity = opacity;
        return this;
    }

    _bindDomEvents() {
        const className = '#model-control-';
        const map = this.map;
        const dom = this.uiMarker.getDOM();
        const on = maptalks.DomUtil.on;

        const getChildDom = (selector) => {
            return dom.querySelector(selector);
        };
        const scale = getChildDom(`${className}${SCALE}`);
        const scaleHighLight = getChildDom(`${className}${SCALE}-${HIGH_LIGHT}`);

        const scaleMouseMove = () => {
            if (!this.isDown) {
                domShow(scaleHighLight);
                if (!this.operateModel) {
                    this.operateModel = SCALE;
                    map.setCursor('col-resize');
                }
            }
        };
        on(scale, MOUSE_ENTER_EVENT, scaleMouseMove);
        on(scale, MOUSE_MOVE_EVENT, scaleMouseMove);

        const rotation = getChildDom(`${className}${ROTATION}`);
        const rotationHighLight = getChildDom(`${className}${ROTATION}-${HIGH_LIGHT}`);
        const rotationMousemove = () => {
            if (!this.isDown) {
                domShow(rotationHighLight);
                if (!this.operateModel) {
                    this.operateModel = ROTATION;
                    map.setCursor('grab');
                }
            }
        };
        on(rotation, MOUSE_ENTER_EVENT, rotationMousemove);
        on(rotation, MOUSE_MOVE_EVENT, rotationMousemove);

        const translate = getChildDom(`${className}${TRANSLATE}`);
        const translateHighLight = getChildDom(`${className}${TRANSLATE}-${HIGH_LIGHT}`);
        const translateMousemove = () => {
            if (!this.isDown) {
                domShow(translateHighLight);
                if (!this.operateModel) {
                    this.operateModel = TRANSLATE;
                    map.setCursor('move');
                }
            }
        };
        on(translate, MOUSE_ENTER_EVENT, translateMousemove);
        on(translate, MOUSE_MOVE_EVENT, translateMousemove);

        const height = getChildDom(`${className}${HEIGHT}`);
        const heightHighLight = getChildDom(`${className}${HEIGHT}-${HIGH_LIGHT}`);
        const heightMousemove = () => {
            if (!this.isDown) {
                domShow(heightHighLight);
                if (!this.operateModel) {
                    this.operateModel = HEIGHT;
                    map.setCursor('row-resize');
                }
            }
        };
        on(height, MOUSE_ENTER_EVENT, heightMousemove);
        on(height, MOUSE_MOVE_EVENT, heightMousemove);

        const mousedownFun = () => {
            this.isDown = true;
            mapConfig(map, false);
        };
        on(scale, MOUSE_DOWN_EVENT, () => {
            mousedownFun();
            this.operateModel = SCALE;
        });
        on(rotation, MOUSE_DOWN_EVENT, () => {
            mousedownFun();
            this.operateModel = ROTATION;
        });
        on(translate, MOUSE_DOWN_EVENT, () => {
            mousedownFun();
            this.operateModel = TRANSLATE;
        });
        on(height, MOUSE_DOWN_EVENT, () => {
            mousedownFun();
            this.operateModel = HEIGHT;
        });

        [scale, rotation, translate, height].filter(element => {
            return element;
        }).forEach(element => {
            on(element, MOUSE_LEAVE_EVENT, e => {
                let hightlight;
                if (element === scale) {
                    hightlight = scaleHighLight;
                } else if (element === rotation) {
                    hightlight = rotationHighLight;
                } else if (element === translate) {
                    hightlight = translateHighLight;
                } else if (element === height) {
                    hightlight = heightHighLight;
                }
                if (!this.isDown) {
                    domHide(hightlight);
                    map.resetCursor();
                    mapConfig(map, true);
                    this.isDown = false;
                    this.operateModel = '';
                    this._fireOutEvent();
                }
            });
        });
        this.highLightDoms = [scaleHighLight, translateHighLight, heightHighLight, rotationHighLight];
    }

    _mouseMove(e) {
        if (!this._enable) {
            return this;
        }
        const { isDown, operateModel, orginScale } = this;
        if (!operateModel) {
            return;
        }
        if (operateModel && !isDown) {
            this.fire(`${operateModel}_in`, e);
        }
        if (!isDown) {
            return;
        }
        const marker = this.uiMarker, layer = this.layer, map = this.map, height = this.height || 0;
        const { panelSize, lineSymbol } = this.options;

        const getPoints = () => {
            const c1 = marker.getCoordinates().copy();
            c1.z = 0;
            const c2 = e.coordinate.copy();
            const res = map.getGLRes();
            const point1 = map.coordToPointAtRes(c1, res);
            // const point2 = map.coordToPointAtRes(c2, res);

            const p1 = map._pointAtResToContainerPoint(point1, res, height);
            const p2 = e.containerPoint.copy();
            // const p2 = map.coordinateToContainerPoint(c2);
            // console.log(p1.toArray(), p2.toArray());
            return [c1, c2, p1, p2];
        };

        function createTipLine(c1, c2) {
            layer.clear();
            const line = new maptalks.LineString([c1, c2], {
                arrowStyle: 'classic', // we only have one arrow style now
                arrowPlacement: 'vertex-last',
                symbol: lineSymbol
            });
            line.addTo(layer);
        }
        if (operateModel === TRANSLATE) {
            const c = e.coordinate.copy();
            c.z = height;
            marker.setCoordinates(c);
            this.layer.clear();
            this.fire(TRANSLATE, Object.assign({}, e, { coordinate: c.copy() }));
        }
        if (operateModel === SCALE) {
            // eslint-disable-next-line no-unused-vars
            const [c1, c2, p1, p2] = getPoints();
            const distance = p2.distanceTo(p1);
            let scale = (distance / (panelSize / 2) - 1);
            if (scale < 0) {
                scale *= 2;
            }
            const modelScale = orginScale + scale;
            this._setMarkerSize(panelSize * (distance * 2 / panelSize));
            c2.z = -height;
            layer.options.altitude = height;
            createTipLine(c1, c2);
            this.fire(SCALE, Object.assign({}, e, { scale: modelScale }));
            this._tempScale = modelScale;
        }
        if (operateModel === ROTATION) {
            // eslint-disable-next-line no-unused-vars
            const [c1, c2, p1, p2] = getPoints();
            const dxdy = p2.sub(p1.x, p1.y);
            const bearing = map.getBearing();
            const rad = getDxDyRad(dxdy, bearing);
            c2.z = -height;
            layer.options.altitude = height;
            createTipLine(c1, c2);
            this.fire(ROTATION, Object.assign({}, e, { rotation: rad / Math.PI * 180 }));
        }
        if (operateModel === HEIGHT) {
            if (!this._mousedownPoint) {
                return;
            }
            const p1 = this._mousedownPoint;
            const p2 = e.containerPoint;
            const dy = (p2.y - p1.y);
            let result = dy * map.getScale() / 40;
            result = -result;
            const modelHeight = this.height + result;
            this._tempHeight = modelHeight;
            const coordinate = this.uiMarker.getCoordinates();
            coordinate.z = modelHeight;
            this.uiMarker.setCoordinates(coordinate);

            const c1 = map.containerPointToCoord(p1);
            const c2 = map.containerPointToCoord(p2);
            layer.options.altitude = 0;
            createTipLine(c1, c2);
            this.fire(HEIGHT, Object.assign({}, e, { height: modelHeight }));
        }
    }

    _mouseUp(e) {
        this.isDown = false;
        this.operateModel = '';
        this._setMarkerSize();
        mapConfig(this.map, true);
        this.map.resetCursor();
        this.layer.clear();
        if (this._tempScale) {
            this.setOriginalScale(this._tempScale);
        }
        if (this._tempHeight) {
            this.height = this._tempHeight;
        }
        this._mousedownPoint = null;
        this.highLightDoms.forEach(dom => {
            domHide(dom);
        });
        this._fireOutEvent();
        return this;
    }

    _mouseDown(e) {
        this._mousedownPoint = e.containerPoint;
        return this;
    }

    _fireOutEvent() {
        const events = [TRANSLATE, ROTATION, SCALE, HEIGHT];
        events.forEach(event => {
            this.fire(`${event}_out`);
        });
        return this;
    }
}
ModelControl.mergeOptions(options);
