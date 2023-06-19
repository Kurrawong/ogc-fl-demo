# Data content

`annotations/`

* contains labels, descriptions etc. for all predicates and some objects in the data
    * _geojson.json - annotations for the GeoJSON model. Not really used now but here for future use
    * ogc-rainbow.json - the OGC's stuff. Simulating us getting it from somewhere remotely
    * semantic-background.json - all the stuff our client already knows, out-of-the box

`contexts/`

* JSON-LD context statements for:
    * GeoJSON
    * GeoSPARQL - "reduced" in that collisions with GeoJSON ('Feature') etc. are removed
    * each dataset
        * Cities
        * Qld GeoFeatures
        * SA 3s

`datasets/`

* the three Features datasets' data in GeoJSON:
    * Cities
    * Qld GeoFeatures
    * SA 3s