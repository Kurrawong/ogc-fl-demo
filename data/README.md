# Data content

`annotations/`

* contains labels, descriptions etc. for all predicates and some objects in the data

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