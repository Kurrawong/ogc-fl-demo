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

const contextUrl = 'https://raw.githubusercontent.com/Kurrawong/ogc-fl-demo/main/data/_context.json';
let sourceUrl = '';

function capitalizeFirstChar(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
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

    const contextConfig = await (await fetch(contextUrl)).json();

    // To clear the GeoJSON layer
    if (geojsonLayer) {
        geojsonLayer.clearLayers();
    }

    let lastLayer = undefined;
    let lastLayerColor = undefined;

    // Load the GeoJSON data
    fetch(sourceUrl)
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {

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
            onEachFeature: function(feature, layer) {

                var geometryType = feature.geometry.type;
                var coordinates = feature.geometry.coordinates;
              
                if(geometryType == 'Point') {
                    updateBoundingBox(coordinates[1], coordinates[0]);
                } else {
                    const bounds = layer.getBounds();

                    // Update the bounding box with the bounds of the layer
                    updateBoundingBox(bounds.getNorth(), bounds.getWest());
                    updateBoundingBox(bounds.getSouth(), bounds.getEast());
                }

                layer.on('click', function() {
                // Function to handle click event
                    showDetails(feature.properties);
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

    function outputProperty(properties, name) {
        let value = properties[name]
        let label = capitalizeFirstChar(name);
        let r = ''
        if(name in contextConfig) {
            const props = contextConfig[name];
            if('label' in props) {
                label = props.label
            }
            const tooltip = 'description' in props ? (
                'chain' in props ? `${props.chain.join('/')}\n${props.description}` :
                props.description
            ) : ('chain' in props ? props.chain.join('/') : undefined);

            const target = ('seeAlso' in props ? props.seeAlso : 
                ('iri' in props ? props.iri : undefined));

            if(target) {
                if(tooltip) {
                    label = `<div class="info"><a title="${tooltip}" target="_blank" href="${target}">${label}<span class="info-icon"></span></a></div>`;
                } else {
                    label = `<a target="_blank" href="${target}">${label}</a>`;
                }
            } else {
                if(tooltip) {
                    label = `<div class="info"><span class="info-text" title="${tooltip}">${label}<span class="info-icon"></span></span></div>`
                }
            }
//            r = `<tr><td colspan="2">${name}: ${JSON.stringify(props)}</td></tr>`
        }
        let strValue = ''
        if(typeof(value) == 'object' && 'length' in value) {
            strValue = value.join('<br/>');
        } else {
            strValue = value;
        }
        return r + `<tr><td class="tbl-label">${label}</td><td class="tbl-value">${strValue}</td></tr>`;
    }

    // Function to handle the click event and display details
    function showDetails(properties) {

        let info = 
            ('name' in properties ? `<h2>${properties.name}</h2>` : '') +
            '<table class="popup-table">';

        for(prop in properties) {
            info+= outputProperty(properties, prop)
        }
        info+= '</table>'

        // Display the details in a popup or any other element on the page
        // Example using Leaflet's popup:
        let popup = L.popup()
            .setLatLng(map.getCenter())
            .setContent(info)
            .openOn(map);

        lastPopup = popup;

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

var checkboxes = document.querySelectorAll('input[type="checkbox"]');

function handleCheckboxClick(event) {
  // Get the clicked checkbox
  var clickedCheckbox = event.target;
  sourceUrl = clickedCheckbox.value;
  start();

  // Deselect all other checkboxes
  checkboxes.forEach(function(checkbox) {
    if (checkbox !== clickedCheckbox) {
      checkbox.checked = false;
    }
  });
}

// Attach event listeners to checkboxes
checkboxes.forEach(function(checkbox) {
  if(sourceUrl == '') {
    sourceUrl = checkbox.value;
  }
  checkbox.addEventListener('click', handleCheckboxClick);
});

// Function to calculate the area of a layer's bounds
function calculateLayerArea(layer) {
    if(!layer.getBounds) {
        return 0;
    }
    var bounds = layer.getBounds();
    var area = (bounds.getNorth() - bounds.getSouth()) * (bounds.getEast() - bounds.getWest());
    return area;
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

start()
