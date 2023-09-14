# Feature Label Online Demonstrator

## Configuration JSON specifications

```json
{
  "title": "#main title to show in the top left",
  "about": "#text to show under the title",
  "annotations": ["#array of annotation urls to json files to use as a default"],
  "annotationsOGC": ["#array of annotation urls to json files to use when clicking the 'Use Rainbow Shine' button"],
  "datasets": [   
      {
          "name": "#dataset name",
          "description": "#description text for the dataset",
          "uri": "#url to the geojson file",
          "contexts": {
              "#option 1 label - On - Level 1": [
                  "#url to json context 1",
                  "#url to json context 2",
                  "#url to json context ...n",
              ],
              "#option 2 label - Off - Level 2": [
                ...
              ],
              "#option 2 label - Another - Level 3": [
                ...
              ]
          }
      }
  ]

}
```

## Using a custom configuration JSON

### config=#urlToJSON

__Example:__
- https://kurrawong.github.io/ogc-fl-demo/web/?config=https://kurrawong.github.io/ogc-fl-demo/web/config-example.json

__Note:__ This will load the application using the specific config URL


__Default:__
When you run the application with no config parameter, the default config.json provided in the project will be used.
- https://kurrawong.github.io/ogc-fl-demo/web/
