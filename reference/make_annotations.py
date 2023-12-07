from pathlib import Path
from rdflib import Graph
import json

REF_DIR = Path(__file__).parent
ANNOTATIONS_DIR = REF_DIR.parent / "data" / "annotations"
print(REF_DIR)
print(ANNOTATIONS_DIR)

q = """
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX sdo: <https://schema.org/>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    
    SELECT ?iri ?name ?description ?range ?seeAlso
    WHERE {
        VALUES ?property_type {
            rdf:Property
            owl:AnnotationProperty
            owl:AsymmetricProperty
            owl:DatatypeProperty
            owl:FunctionalProperty
            owl:ObjectProperty
        }
        
        VALUES ?name_type {
            sdo:name
            rdfs:label
            skos:prefLabel
        }
        
        VALUES ?description_type {
            sdo:description
            rdfs:comment
            skos:definition
        }
        
        ?iri  a ?property_type ;
            ?name_type ?name ;
            ?description_type ?description ;
        .
        
        OPTIONAL {
            ?iri rdfs:range ?range
        }
        
        OPTIONAL {
            ?iri rdfs:seeAlso ?seeAlso
        }
    }
    """
for f in sorted(REF_DIR.glob("*.ttl")):
    g = Graph().parse(f)
    j = {}
    for r in g.query(q):
        print(r)
        j[str(r[0])] = {
            "name": r[1],
            "description": r[2],
        }

        if r[3] is not None:
            j[str(r["iri"])]["range"] = str(r[3])

        if r[4] is not None:
            j[str(r["iri"])]["seeAlso"] = str(r[4])

    with open(ANNOTATIONS_DIR / f.name.replace("ttl", "json"), "w") as f2:
        json.dump(j, f2, indent=4)
