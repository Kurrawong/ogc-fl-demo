
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

async function expandProperties(featureNum, feature, context, log) {

  let name = 'name' in feature.properties ? ' (' + feature.properties['name'] + ')' : '';
  name = name == '' ? ('id' in feature.properties ? feature.properties['id'] : '') : name;
  name = name == '' ? ('iri' in feature.properties ? feature.properties['iri'] : '') : name;
  name = name == '' ? featureNum : name;

  const idx = `Feature "${name}"`;

  const ldExpanded = await jsonld.expand({...context, ...feature.properties});
  log[idx + ': JSON-LD expanded'] = ldExpanded;
  const flat = flattenExpandedJsonLd(ldExpanded);
  log[idx + ': Flatterned values'] = flat;
}

async function init(fileParam) {

  const urlParams = new URLSearchParams(window.location.search);
  // const fileParam = urlParams.get('file');
  const response = await fetch(fileParam); 
  let data = await response.json();
  const log = {};
  log['Original'] = data;

  if(data['@context']) {
    log['Context file'] = data['@context'];
    const context = await (await fetch(data['@context'])).json();
    log['Context loaded'] = context;
    // manual process of features...
    if(data.type == 'Feature') {
        data = {type: 'FeatureCollection', features: [data]};
    }
    if(data.type == 'FeatureCollection' && data.features) {
        data.features.forEach(async (feature, index)=>{
            await expandProperties(index + 1, feature, context, log);
        })
    }
  } else {
    log['No context'] = 'No @context found';
  }
  console.log("LOG", log)
  setTimeout(()=>{
    document.getElementById('results').innerHTML = '<div>' + 
      Object.keys(log).map(key=>{
        return `<h4>${key}</h4><pre style="max-height:400px;overflow-y:scroll;">${JSON.stringify(log[key], undefined, '  ')}</pre>`;
      }).join('') + '</div>';
  })
}

