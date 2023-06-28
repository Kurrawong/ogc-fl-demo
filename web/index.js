function setElementHeightToFillScreen(elementId) {
    var element = document.getElementById(elementId);
    var screenHeight = window.innerHeight;
    var elementOffsetTop = element.offsetTop;
    var elementHeight = screenHeight - elementOffsetTop - 20;
  
    element.style.height = elementHeight + "px";
}

setElementHeightToFillScreen('map');

// Create a Leaflet map
var map = L.map('map');//.setView([-33.93044545314443, 18.416774422329922], 5)  //.setView([51.505, -0.09], 13);
let geojsonLayer;
let lastPopup = undefined;

// Add a tile layer to the map (optional)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
}).addTo(map);

let contextSet = [];
let annotationConfig = {};
let annotationConfigFull = {};
let sourceUrl = '';
let iriRefs = {};
let iriLayers = {};
let configData = {};

function capitalizeFirstChar(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getAbsoluteURL(relativePath) {
    const baseURL = new URL(window.location.href);
    const absoluteURL = new URL(relativePath, baseURL).href;
    return absoluteURL;
}

async function mergeContexts(contextUrls) {
    if(contextUrls.length == 0) {
        return {}
    }
    try {
      const contextResponses = await Promise.all(
        contextUrls.map(url => fetch(url).then(response => response.json()))
      );
  
      const mergedContext = {
        "@context": {
          ...contextResponses.reduce((acc, response) => {
            return { ...acc, ...response["@context"] };
          }, {})
        }
      };
  
      return mergedContext;
    } catch (error) {
      console.error(error);
    }
}

function flattenExpandedJsonLd(expanded) {
    const flattened = expanded.map(item => {
      const properties = {};
      for (const key in item) {
        const value = item[key];
        if (Array.isArray(value)) {
          properties[key] = value.map(flattenValue);
        } else {
          properties[key] = flattenValue(value);
        }
      }
      return properties;
    });
    return flattened.length === 1 ? flattened[0] : flattened;
}

function ogcShine(el) {
    //console.log('Std annotations', annotationConfig);
    //console.log('+OGC annotations', annotationConfigFull);

    const isOGC = el.parentElement.getAttribute('class') != 'ogc-off'
    el.parentElement.setAttribute('class', 'ogc-loading');

    setTimeout(()=>{ 
        el.parentElement.setAttribute('class', isOGC ? 'ogc-off' : 'ogc-loaded')
        el.parentElement.getElementsByClassName('btn')[0].classList.add('disabled');
        M.toast({html: (isOGC ? 'Rainbow shine removed' : 'Showing rainbow shine'), })
    }, 2500);
}
  
function flattenValue(value) {
    if (typeof value === 'object' && value !== null && '@value' in value) {
      return value['@value'];
    }
    if (Array.isArray(value)) {
      if (value.length === 1 && typeof value[0] === 'object' && '@value' in value[0]) {
        return value[0]['@value'];
      }
      return value.map(flattenValue);
    }
    if (typeof value === 'object' && value !== null) {
      const result = {};
      for (const key in value) {
        result[key] = flattenValue(value[key]);
      }
      return result;
    }
    return value;
}
        
async function start() {

    // Initialize min/max values with initial coordinates
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    // Helper function to update the bounding box based on a single coordinate
    function updateBoundingBox(lat, lng) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
    }    

    // To clear the GeoJSON layer
    if (geojsonLayer) {
        geojsonLayer.clearLayers();
    }

    let lastLayer = undefined;
    let lastLayerColor = undefined;

//    alert(JSON.stringify(contextSet));

    const contexts = contextSet.map((context) => getAbsoluteURL(context));

    //console.log("Source", getAbsoluteURL(sourceUrl));

    //console.log('Applying ', contexts)

    const mergedContext = await mergeContexts(contexts);

    //console.log('MERGED CONTEXTS', contexts)
    //console.log("XCONTENT", mergedContext);

    // Load the GeoJSON data
    fetch(sourceUrl)
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {

        // clear all previous IRI references
        iriRefs = {};
        iriLayers = {};
        if(lastPopup) {
            const closeItems = document.getElementsByClassName('leaflet-popup-close-button');
            // work around, as close popup method doesn't appear to close the popup
            if(closeItems.length > 0) {
                closeItems[0].click();
            }
            lastPopup = undefined;
        }

        lastLayer = undefined;
        // Create a Leaflet GeoJSON layer and add it to the map
        geojsonLayer = L.geoJSON(data, {
            onEachFeature: async function(feature, layer) {

                var geometryType = feature.geometry.type;
                var coordinates = feature.geometry.coordinates;
                var popupCoords = undefined
              
                if(geometryType == 'Point') {
                    updateBoundingBox(coordinates[1], coordinates[0]);
                    popupCoords = {lat: coordinates[1], lng: coordinates[0]}
                } else {
                    const bounds = layer.getBounds();
                    popupCoords = bounds.getCenter();
                    // Update the bounding box with the bounds of the layer
                    updateBoundingBox(bounds.getNorth(), bounds.getWest());
                    updateBoundingBox(bounds.getSouth(), bounds.getEast());
                }

                let propertiesExpanded = feature.properties;
                try {

                    propertiesExpanded = flattenExpandedJsonLd(await jsonld.expand({...mergedContext, ...feature.properties}));
                    // console.log("XX", feature.properties, propertiesExpanded)
                    if(propertiesExpanded.length == 0) {
                        propertiesExpanded = feature.properties;
                    }
                    //console.log(propertiesExpanded);
                } catch (ex) {
                    console.log(ex, feature.properties)
                }
                // console.log("PROPS", feature.properties);
                // console.log("PROPS EXPANDED", flattenExpandedJsonLd(propertiesExpanded));

                if('name' in feature.properties && 'iri' in feature.properties) {
                    iriRefs[feature.properties.iri] = feature.properties.name;
                    iriLayers[feature.properties.iri] = layer;
                }

                layer.on('click', function() {
                    // Function to handle click event

                    console.log("1. SHOWING DETAILS FOR", feature.properties);
                    console.log("2. EXPANDED DETAILS", propertiesExpanded);

                    showDetails(popupCoords, propertiesExpanded);//feature.properties);
                    if(layer.setStyle) {
                        if(lastLayer) {
                            lastLayer.setStyle({color: lastLayerColor});
                        }
                        lastLayerColor = layer.getElement().getAttribute('stroke')
                        layer.setStyle({ color: 'red' }); // Change the color to red or any desired color
                        lastLayer = layer;
                    }
                });

            }
        }).addTo(map);

        map.on("click", function(event) {
            var id = event.originalEvent.target.id;
          
            // Check if the clicked layer is the map
            if (id == 'map') {
                if(lastLayer) {
                    lastLayer.setStyle({color: lastLayerColor});
                }
            }
        })

        // Create a Leaflet LatLngBounds object using the bounding box coordinates
        var bounds = L.latLngBounds([[minLat, minLng], [maxLat, maxLng]]);

        // Set the Leaflet map view to fit the bounding box
        map.fitBounds(bounds);

        bringToFrontLayers();

    });

    function outputPropertyValue(name, text, annotations) {
        let displayText = ''; 
        if(text.match(/^https?:\/\//)) {
            if(text in annotations && 'name' in annotations[text]) {
                displayText = annotations[text].name;
            }
        }
        var urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, function(url) {
            if((name != 'iri' && name != '@id') && url in iriRefs) {
                return `<a href="${url}" onClick="internalLink(event)">${iriRefs[url]}</a>`;
            } else {
                if(name =='@id') {
                    return `<a data-tooltip=${url} class="ext" href="${url}">${url}<i class="material-icons">open_in_new</i></a>`;
                } else {
                    return `<a class="ext" href="${url}">${displayText != '' ? displayText : url}<i class="material-icons">open_in_new</i></a>`;
                }
            }
        });
    }

    function outputProperty(properties, name, annotations) {
        let value = properties[name]
        const nameLink = name.match(/^https?:\/\//) ? name : undefined
        //alert(name)
        const defLabel = name.indexOf('http') == 0 && name.indexOf('#') > 0 ? name.split('#')[1] : name;
        let label = defLabel.indexOf('http') == 0 ? defLabel : capitalizeFirstChar(defLabel);

        let r = '';

        let strValue = '';
        let helpValue = '';
        if(typeof(value) == 'object' && 'length' in value) {
            helpValue = value.join(', ');
            strValue = value.map(val=>outputPropertyValue(name, val.toString(), annotations)).join('<br/>');
        } else {
            helpValue = value.toString();
            strValue = outputPropertyValue(name, value.toString(), annotations);
        }

        if(name in annotations) {
            const props = annotations[name];
            //console.log(props, properties);
            if('name' in props) {
                label = props.name
            }
            let tooltip = 'description' in props ? (
                'chain' in props ? `${props.chain.join('/')}\n${props.description}` :
                props.description
            ) : ('chain' in props ? props.chain.join('/') : undefined);

            if(tooltip) {
                tooltip = Mustache.render(tooltip, {...properties, value: helpValue});
            }

            const target = ('seeAlso' in props ? props.seeAlso : 
                ('iri' in props ? props.iri : (nameLink ? nameLink : undefined)));

            if(target) {
                if(tooltip) {
                    label = `<div class="info"><a class="ext2" data-position="bottom" data-tooltip="${tooltip}" target="_blank" href="${target}">${label}<i class="material-icons">open_in_new help_outline</i></a></div>`;
                } else {
                    label = `<a class="ext2" target="_blank" href="${target}">${label}<i class="material-icons">open_in_new</i></a>`;
                }
            } else {
                if(tooltip) {
                    label = `<div class="info"><span class="info-text" data-position="bottom" data-tooltip="${tooltip}">${label}<i class="material-icons">help_outline</i></span></div>`
                }
            }
//            r = `<tr><td colspan="2">${name}: ${JSON.stringify(props)}</td></tr>`
        }
        
        return r + `<tr><td class="tbl-label">${label}</td><td class="tbl-value">${strValue}</td></tr>`;
    }

    // Function to handle the click event and display details
    function showDetails(popupCoords, properties) {

        const displayName = 'https://schema.org/name' in properties ? properties['https://schema.org/name'] :
            '@id' in properties ? properties['@id'] : 'Unknown name or ID'

        let info = `<table class="popup-table nonogc-props">`;
        let infoOGC = `<table class="popup-table ogc-props">`;

        for(prop in properties) {
//            if(prop == '@id') continue;
            info+= outputProperty(properties, prop, annotationConfig);
            infoOGC+= outputProperty(properties, prop, annotationConfigFull);
        }
        info+= '</table>'
        infoOGC+= '</table>'
        //console.log(popupCoords);

        // Display the details in a popup or any other element on the page
        let popup = L.popup()
            .setLatLng(popupCoords)
            .setContent(`<div class="ogc-off"><h2>${displayName}</h2>` + info + infoOGC + 
                `<button class="btn" onclick="ogcShine(this)">Add Rainbow Shine</button>` + 
                `<div class="progress-wrapper"><div class="progress"><div class="indeterminate"></div></div></div>` +
                `</div>`)
            .openOn(map);

        lastPopup = popup;

        let elems = document.querySelectorAll('[data-tooltip]');
        M.Tooltip.init(elems, {});

        var popupContent = popup.getElement()
        var popupWidth = popup.getElement().clientWidth

        var table = popupContent.querySelector('.popup-table');
        var elLabel = popupContent.querySelector('.popup-table .tbl-label');
        var elValues = popupContent.querySelectorAll('.popup-table .tbl-value');
        if (table && popupWidth && elLabel && elValues) {
            var maxWidth = popupWidth - 40;
            table.style.maxWidth = maxWidth + 'px';
            table.style.width = maxWidth + 'px';
            const labelWidth = elLabel.getBoundingClientRect().width;
            for (var i = 0; i < elValues.length; i++) {
                elValues[i].style.maxWidth = (maxWidth - labelWidth - 20) + 'px';
            }
        }
    }
}

let checkboxes = [];
let currentQuality = '';
let currentSource;
let nameEl = document.getElementById('ds-name');
let descriptionEl = document.getElementById('ds-description');

function setActive(cb) {
    currentSource = cb;
    nameEl.innerText = cb.getAttribute('data-name');
    descriptionEl.innerText = cb.getAttribute('data-description');
}

function setContext() {
    if(currentQuality) {
        contextSet = JSON.parse(currentSource.getAttribute('data-contexts'))[currentQuality];
    }
}

function handleCheckboxClick(event) {
    // Get the clicked checkbox
    var clickedCheckbox = event.target;
    if(clickedCheckbox.getAttribute('data-group') == 'datasets') {
        sourceUrl = clickedCheckbox.value;
        setActive(clickedCheckbox);
    } else {
        currentQuality = clickedCheckbox.value;
    }

    // Deselect all other checkboxes
    checkboxes.forEach(function(checkbox) {
        if(checkbox.getAttribute('data-group') == clickedCheckbox.getAttribute('data-group')) {
            if (checkbox !== clickedCheckbox) {
                checkbox.checked = false;
            }
        }
    });

    setContext();
    start();
}

// Function to calculate the area of a layer's bounds
function calculateLayerArea(layer) {
    if(!layer.getBounds) {
        return 0;
    }
    var bounds = layer.getBounds();
    var area = (bounds.getNorth() - bounds.getSouth()) * (bounds.getEast() - bounds.getWest());
    return area;
}

function internalLink(event) {
    event.preventDefault();
    //console.log(iriLayers[event.target])
    iriLayers[event.target].fireEvent('click');
}

// Function to bring layers within the bounding box to the front
function bringToFrontLayers() {
  
    // Bring the main GeoJSON layer to the front and change its color
    geojsonLayer.bringToFront();
  
    // Sort the layers based on their area in ascending order
    var sortedLayers = geojsonLayer.getLayers().sort(function (layerA, layerB) {
      var areaA = calculateLayerArea(layerA);
      var areaB = calculateLayerArea(layerB);
      return areaB - areaA;
    });
  
    // Loop through the sorted layers and bring them to the front
    sortedLayers.forEach(function (layer, index) {
      if (index > 0 && layer.bringToFront) {
        layer.bringToFront();
      }
    });
}

async function mergeJsonLdData(jsonDataArray) {
    let mergedData = {};
  
    for (const jsonData of jsonDataArray) {
      mergedData = await jsonld.merge(mergedData, jsonData);
    }
  
    // Convert mergedData back to JSON-LD format
    const mergedJsonLd = JSON.stringify(mergedData, null, 2);
  
    return mergedJsonLd;
}

async function mergeJsonFromUrls(urls) {
    const mergedData = await Promise.all(
      urls.map(url => fetch(url).then(response => response.json()))
    ).then(jsonDataArray =>
      jsonDataArray.reduce((merged, json) => ({ ...merged, ...json }), {})
    );
  
    return mergedData;
}

const init = async () => {
    try {
        const response = await fetch('./config.json'); 
        configData = await response.json();

        // get context quality labels
        let qualities = [];
        configData.datasets.forEach(dataset=>{
            Object.keys(dataset.contexts).forEach(context=>{
                if(qualities.indexOf(context) < 0) {
                    qualities.push(context);
                }
            })
        })

        annotationConfig = await mergeJsonFromUrls(configData.annotations);
        annotationConfigFull = await mergeJsonFromUrls([...configData.annotations, ...configData.annotationsOGC]);

        //console.log("CONFIG", annotationConfig);

        const datasetsContainer = document.getElementById('datasets');
        const qualityContainer = document.getElementById('quality');
        datasetsContainer.innerHTML = configData.datasets.map((dataset, index) => `
            <label>
            <input
                data-group="datasets"
                data-name="${dataset.name}" 
                data-description="${dataset.description}"
                class="filled-in" ${!index && 'checked'} 
                data-contexts=${JSON.stringify(dataset.contexts)}
                value="${dataset.uri}" type="checkbox" />
            <span>${dataset.name}</span>
            </label>
        `).join('');
        qualityContainer.innerHTML = qualities.map((quality, index)=>`
            <label>
            <input
                data-group="quality"
                data-name="${quality}" 
                data-description="${quality}"
                class="filled-in" ${!index && 'checked'} 
                value="${quality}" type="checkbox" />
            <span>${quality}</span>
            </label>
        `).join('');
        document.getElementById('title').innerText = configData.title;
        document.getElementById('about').innerText = configData.about;
        checkboxes = document.querySelectorAll('input[type="checkbox"]');
        
        // Attach event listeners to checkboxes
        checkboxes.forEach(function(checkbox) {
            if(sourceUrl == '' && checkbox.checked) {
                sourceUrl = checkbox.value;
                setActive(checkbox);
            }
            if(currentQuality == '' && checkbox.getAttribute('data-group') == 'quality') {
                currentQuality = checkbox.value;
            }
            checkbox.addEventListener('click', handleCheckboxClick);
        });
        setContext();
  
        start()

    } catch (error) {
        console.error('Error fetching or parsing JSON:', error);
    }
};

init()
