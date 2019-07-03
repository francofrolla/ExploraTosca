var geometry = /* color: #d63000 */ee.Geometry.Point([-63.09186595940224, -37.768442474118594]);
Map.centerObject(geometry, 15)
Map.setOptions("HYBRID")
//bands
var classified = ee.Image(0);
var composite = ee.Image(0);
var trained = 0;
var training1 = ee.FeatureCollection([])
var pts = ee.FeatureCollection([])
var pts_validacion = ee.FeatureCollection([])
//var lote = ee.Geometry.Polygon([0,0]);
var visParams = ee.Dictionary({});
var params = ee.Dictionary({});
var minimisimo = 0;
var maximisimo = 0;
var que_satelite = ee.String("");
var COLLECCION = ee.String("");
var años = ee.List([""]);
var meses = {Enero: [1], Febrero: [2], Marzo: [3], Abril: [4], Mayo: [5], Junio: [6], Julio: [7], Agosto: [8], Septiembre: [9], Octubre: [10], Noviembre: [11], Diciembre: [12]};
var select_años = ui.Select({placeholder:"Año", items: Object.keys(años)});
var select_años_f = ui.Select({placeholder:"Año", items: Object.keys(años)});
var select_meses = ui.Select({placeholder:"Mes", items: Object.keys(meses)});
var select_meses_f = ui.Select({placeholder:"Mes", items: Object.keys(meses)});
var escala = ee.Number(10)   
var lote = ee.Geometry.Polygon([[0,0],[0,0],[0,0],[0,0]])





 var lista_satelites = {
     Sentinel_2: ["Sentinel_2"],
     Landsat_8: ["Landsat_8"],
     Landsat_5: ["Landsat_5"]
        };
        
var bandas = ee.List([""])     
var bandas1 = ee.List([""])  
var bandas_L5 = ee.List(['B1','B2', 'B3', 'B4', 'B5', 'B7',"BQA"]);
var bandas_L8 = ee.List(['B2', 'B3', 'B4', 'B5', 'B6', 'B7',"BQA"]);
var bandas_S2 = ee.List(['B2','B3', 'B4', 'B8', 'QA60']);

function setDisplay(dictionary) {
  visParams = {
    bands: ['classification'], 
    min: [dictionary['classification_p5'],],
    max: [dictionary['classification_p95'],],
    palette: ["FFFFFF", "CE7E45", "DF923D", "F1B555", "FCD163", "99B718", "74A901", "66A000", "529400", "3E8601", "207401", "056201", "004C00", "023B01", "012E01", "011D01", "011301"]
  };
  
  Map.addLayer(classified, visParams, 'clasificado');
  Map.centerObject(classified,15)
  var min  = ee.Number(params .get("classification_p5")).round()
  var max  = ee.Number(params .get("classification_p95")).round()
    var min_cliente = min.evaluate(function(value){
      var max_cliente = max.evaluate(function(value1){graficar_escala(value,value1)}
       )});
  
  //graficar_escala(min_cliente,max_cliente)
  boton_estadisticos.style().set(estilo2)
  boton_descargas.style().set(estilo2)
  
  
  
}

var randomForest = function(año_inicio,año_fin,mes_inicio,mes_final,graficar) {

que_satelite = que_mision.getValue()
print(que_satelite)

if (que_satelite === "Landsat_8") {COLLECCION = 'LANDSAT/LC08/C01/T1_TOA'; bandas = bandas_L8; escala = 30}
if (que_satelite === "Sentinel_2") {COLLECCION = 'COPERNICUS/S2'; bandas = bandas_S2; escala = 10}
if (que_satelite === "Landsat_5") {COLLECCION = 'LANDSAT/LT05/C01/T1_TOA'; bandas = bandas_L5; escala = 30}





var coleccion = ee.ImageCollection(COLLECCION)
    .filterBounds(lote)
    .filter(ee.Filter.calendarRange(año_inicio,año_fin,'year'))
    .filter(ee.Filter.calendarRange(mes_inicio,mes_final,'month'))
    .select(bandas);

print(coleccion)
//Genial hay que generar una masacara para cada satelite.....

 if (que_satelite === "Sentinel_2") {
coleccion = coleccion.map(agregar_nubes);
coleccion = coleccion.filterMetadata('mascara', 'equals', 0);
print("imagenes observadas", coleccion.size())
}


 if (que_satelite != "Sentinel_2") {
coleccion = coleccion.map(agregar_nubes_L8);
coleccion = coleccion.filterMetadata('mascara', 'less_than', 5000);
coleccion = coleccion.map(function(image){image.multiply(10000); return image});
print("imagenes observadas", coleccion.size())
}

 if (que_satelite != "Sentinel_2") {
coleccion = coleccion.map(
function(image){
image = image.multiply(10000); 
image = image.toInt16()
return image;
  }
);
}


bandas1 = bandas.slice(1,(bandas.length().subtract(1)))

composite = coleccion.median();
composite = composite.clip(lote);

var training = composite.select(bandas1).sampleRegions({
  collection: pts,
  properties: ['profundida'],
  scale: escala
});



 //Train a CART classifier with default parameters.
trained = ee.Classifier.svm().setOutputMode('REGRESSION').train(training, 'profundida', bandas1);

//Classify the input imagery.
classified = composite.select(bandas1).classify(trained);


training1 = classified.sampleRegions({
  collection: pts,
  properties: ['profundida'],
  scale: escala
});

print(training1)
var y = ee.Array(training.aggregate_array("profundida"))
var x = ee.Array(training1.aggregate_array("classification"))


var chart = ui.Chart.array.values(y,0,x)
    .setSeriesNames(["Serie"])
    .setOptions({
      title: 'Profundidad estimada y profundidad suelo (Datos Entrenamiento)',
      hAxis: {'title': 'profundidad estimada'},
      vAxis: {'title': 'profundidad real'},
      pointSize: 3,
});


//Map.add(inspectorPanel);
inspectorPanel.add(chart);

//

params = classified.select(["classification"]).reduceRegion({
    reducer: ee.Reducer.percentile([5, 95]), 
    geometry: lote,
    scale: escala
     });
   params.evaluate(setDisplay);
  }
  
var rmse_calculo = function(){
  
  
  
//Validacion de datos
var validation = composite.select(bandas1).sampleRegions({
  collection: pts_validacion,
  properties: ['profundida'],
  scale: escala
});

var diferencia = function(feature) {
  var estimado = ee.Number(feature.get('clasificado'))
  var real = ee.Number(feature.get('profundida'))
  var diff = estimado.subtract(real)
  return feature.set('diferencia', diff.pow(2));
};

// Classify the validation data.
var validated = validation.classify(trained,"clasificado");
validated = validated.map(diferencia)

var rmse =ee.Number(validated.reduceColumns(ee.Reducer.sum(), ['diferencia']).get('sum'))
   .divide(validated.size())
   .sqrt();

return rmse;
}

var pearson = function() {

var coeficientes = function(feature) {
  var estimado = ee.Number(feature.get("classification"));
  var real = ee.Number(feature.get('profundida'));
  var multiplo = estimado.multiply(real);
  return feature.set('xy', multiplo);
};

var coeficientes2 = function(feature) {
  var estimado = ee.Number(feature.get("classification"));
  return feature.set('x2', estimado.pow(2));
};

var coeficientes3 = function(feature) {
  var real = ee.Number(feature.get('profundida'));
  return feature.set('y2', real.pow(2));
};


training1 = training1.map(coeficientes)
training1 = training1.map(coeficientes2)
training1 = training1.map(coeficientes3)


var B8sum = ee.Number(training1.reduceColumns(ee.Reducer.sum(), ["classification"]).get('sum'))
var profundidasum = ee.Number(training1.reduceColumns(ee.Reducer.sum(), ['profundida']).get('sum'))
var x2_sum = ee.Number(training1.reduceColumns(ee.Reducer.sum(), ['x2']).get('sum'))
var y2_sum = ee.Number(training1.reduceColumns(ee.Reducer.sum(), ['y2']).get('sum'))
var xy_sum = ee.Number(training1.reduceColumns(ee.Reducer.sum(), ['xy']).get('sum'))
var n = ee.Number(training1.size()) 


var uno = n.multiply(xy_sum)
var dos = B8sum.multiply(profundidasum)
var tres = (n.multiply(x2_sum)).subtract((B8sum.pow(2)))
var cuatro = (n.multiply(y2_sum)).subtract((profundidasum.pow(2)))

var r = ((uno.subtract(dos)).divide((tres.multiply(cuatro)).sqrt())).pow(2)
return r
}

//funcion para dibujar lote // extraida de https://gis.stackexchange.com/questions/270033/convert-or-add-hand-drawn-geometries-to-featurecollection-as-they-are-drawn-on-g

var dibujarlote = function() {
  var tool = new DrawAreaTool(Map)
  // subscribe to selection
  tool.onFinished(function(area) {
    
    
  var texto1 = ui.Label({value: "Ingrese fechas de busqueda", style: estilo_apagado })
  var texto2 =ui.Label({value: "Desde:", style: estilo_apagado})
  var texto3 =ui.Label({value: "Hasta:", style: estilo_apagado})
  
  que_satelite = que_mision.getValue()
  if (que_satelite === "Landsat_5") {años = {1984: [1984],1985: [1985],1986: [1986],1987: [1987],1988: [1988],1989: [1989],1990: [1990],1991: [1991],1992: [1992],1993: [1993],1994: [1994],1995: [1995],1996: [1996],1997: [1997],1998: [1998],1999: [1999],2000: [2000],2001: [2001],2002: [2002],2003: [2003],2004: [2004],2005: [2005],2006: [2006],2007: [2007],2008: [2008],2009: [2009],2010: [2010],2011: [2011]}}
  if (que_satelite === "Sentinel_2") {años = {2016: [2016], 2017: [2017], 2018: [2018], 2019: [2019]}}
  if (que_satelite === "Landsat_8") {años = {2013: [2013],2014: [2014],2015: [2015],2016: [2016], 2017: [2017], 2018: [2018], 2019: [2019]}}


  select_años = ui.Select({placeholder:"Año", items: Object.keys(años),style: estilo_fechas_apagado})
  select_meses = ui.Select({placeholder:"Mes", items: Object.keys(meses),style: estilo_fechas_apagado})
  select_años_f = ui.Select({placeholder:"Año", items: Object.keys(años),style: estilo_fechas_apagado})
  select_meses_f = ui.Select({placeholder:"Mes", items: Object.keys(meses),style: estilo_fechas_apagado})
   
   var panel_fechas =  ui.Panel({
    widgets: [ 
    ui.Panel({widgets: [texto1, texto2], style: estilo2}),
    ui.Panel({widgets: [select_años, select_meses],layout: ui.Panel.Layout.flow('horizontal'), style: estilo3}),
    ui.Panel({widgets: [texto3], style: estilo2}),
    ui.Panel({widgets: [select_años_f, select_meses_f],layout: ui.Panel.Layout.flow('horizontal'), style: estilo3}),

      ],
    style: estilo_widgets,
    layout: ui.Panel.Layout.flow('vertical'),
    })

    
    lote = area;
    texto1.style().set(estilo1)
    texto2.style().set(estilo1)
    texto3.style().set(estilo1)
    select_meses.style().set(estilo_fechas)
    select_años.style().set(estilo_fechas)
    select_meses_f.style().set(estilo_fechas)
    select_años_f.style().set(estilo_fechas)
    boton_iniciar.style().set(estilo2)
    
    main.insert(1,panel_fechas)
    
      })
 
  tool.startDrawing()

}


var renovar_fechas = function(){
  
  main.clear()
  
  var texto1 = ui.Label({value: "Ingrese fechas de busqueda", style: estilo_apagado })
  var texto2 =ui.Label({value: "Desde:", style: estilo_apagado})
  var texto3 =ui.Label({value: "Hasta:", style: estilo_apagado})
  
  que_satelite = que_mision.getValue()
  if (que_satelite === "Landsat_5") {años = {1984: [1984],1985: [1985],1986: [1986],1987: [1987],1988: [1988],1989: [1989],1990: [1990],1991: [1991],1992: [1992],1993: [1993],1994: [1994],1995: [1995],1996: [1996],1997: [1997],1998: [1998],1999: [1999],2000: [2000],2001: [2001],2002: [2002],2003: [2003],2004: [2004],2005: [2005],2006: [2006],2007: [2007],2008: [2008],2009: [2009],2010: [2010],2011: [2011]}}
  if (que_satelite === "Sentinel_2") {años = {2016: [2016], 2017: [2017], 2018: [2018], 2019: [2019]}}
  if (que_satelite === "Landsat_8") {años = {2013: [2013],2014: [2014],2015: [2015],2016: [2016], 2017: [2017], 2018: [2018], 2019: [2019]}}


  select_años = ui.Select({placeholder:"Año", items: Object.keys(años),style: estilo_fechas_apagado})
  select_meses = ui.Select({placeholder:"Mes", items: Object.keys(meses),style: estilo_fechas_apagado})
  select_años_f = ui.Select({placeholder:"Año", items: Object.keys(años),style: estilo_fechas_apagado})
  select_meses_f = ui.Select({placeholder:"Mes", items: Object.keys(meses),style: estilo_fechas_apagado})
   
   var panel_fechas =  ui.Panel({
    widgets: [ 
    ui.Panel({widgets: [texto1, texto2], style: estilo2}),
    ui.Panel({widgets: [select_años, select_meses],layout: ui.Panel.Layout.flow('horizontal'), style: estilo3}),
    ui.Panel({widgets: [texto3], style: estilo2}),
    ui.Panel({widgets: [select_años_f, select_meses_f],layout: ui.Panel.Layout.flow('horizontal'), style: estilo3}),

      ],
    style: estilo_widgets,
    layout: ui.Panel.Layout.flow('vertical'),
    })

    texto1.style().set(estilo1)
    texto2.style().set(estilo1)
    texto3.style().set(estilo1)
    select_meses.style().set(estilo_fechas)
    select_años.style().set(estilo_fechas)
    select_meses_f.style().set(estilo_fechas)
    select_años_f.style().set(estilo_fechas)
    boton_iniciar.style().set(estilo2)
    
     main.add(panel_inicio);
     main.add(panel_fechas);
     main.add(panel_iniciar);
    
    
      }



















var DrawAreaTool = function(map) {
  this.map = map
  this.layer = ui.Map.Layer({name: 'lote', visParams: { color:'yellow' }})
  this.selection = null
  this.active = false
  this.points = []
  this.area = null
  
  this.listeners = []

  var tool = this;
  
  this.initialize = function() {
    this.map.onClick(this.onMouseClick)
    this.map.layers().add(this.layer)
  }
  
  this.startDrawing = function() {
    this.active = true
    this.points = []

    this.map.style().set('cursor', 'crosshair');
    this.layer.setShown(true)
  }
  
  this.stopDrawing = function() {
    tool.active = false
    tool.map.style().set('cursor', 'hand');

    if(tool.points.length < 2) {
      return
    }

    tool.area = ee.Geometry.Polygon(tool.points)
    tool.layer.setEeObject(tool.area)

    tool.listeners.map(function(listener) {
      listener(tool.area)
    })
  }
  
  /***
   * Mouse click event handler
   */
  this.onMouseClick = function(coords) {
    if(!tool.active) {
      return
    }
    
    tool.points.push([coords.lon, coords.lat])

    var geom = tool.points.length > 1 ? ee.Geometry.LineString(tool.points) : ee.Geometry.Point(tool.points[0])
    tool.layer.setEeObject(geom)
    
    var l = ee.Geometry.LineString([tool.points[0], tool.points[tool.points.length-1]]).length(1).getInfo()

    if(tool.points.length > 1 && l / Map.getScale() < 5) {
       tool.stopDrawing()
    }
  }
  
  /***
   * Adds a new event handler, fired on feature selection. 
   */
  this.onFinished = function(listener) {
    tool.listeners.push(listener)
  }
  
  this.initialize()
}


//Termina Script

//var bands = (['B1','B2', 'B3', 'B4', 'B5', 'B7']);

var agregar_nubes = function(image) {
    var meanDict = image.reduceRegion({
    reducer: ee.Reducer.anyNonZero(),
    geometry: lote,
    scale: 10,
    maxPixels: 1e9
    });
    return image.set("mascara",meanDict.get("QA60"));
    };

var agregar_nubes_L8 = function(image) {
    var qa = image.select('BQA');  
    var mask = qa.bitwiseAnd(1 << 4).eq(0);
    var nubes = image.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: lote,
    scale: 30,
    maxPixels: 1e9
    });
    return image.set("mascara",nubes.get("BQA"));
    };

var estilo_imagen = {
  min: 0,
  backgroundColor: "#35373a",
  max: 1,
  palette: ["FFFFFF", "CE7E45", "DF923D", "F1B555", "FCD163", "99B718", "74A901", "66A000", "529400", "3E8601", "207401", "056201", "004C00", "023B01", "012E01", "011D01", "011301"]
};

function ColorBar(palette) {
  return ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0),
    params: {
      bbox: [0, 0, 1, 0.1],
      dimensions: '100x10',
      format: 'png',
      min: 0,
      max: 1,
      palette: palette,
    },
    style: {stretch: 'horizontal', margin: '0px 0px', backgroundColor: "#35373a", color: "white"},
  });
}

function leyenda(valor_inicial, valor_final) {
  var labelPanel = ui.Panel({
      widgets: [
        ui.Label(valor_inicial + " cm", {margin: '4px 8px', backgroundColor: "#ffffff"}),
        ui.Label(valor_final + " cm", {margin: '4px 8px',stretch: "horizontal", textAlign: "right", backgroundColor: "#ffffff" })
      ],
      style: {backgroundColor: "#ffffff", color: "black"},
      layout: ui.Panel.Layout.flow('horizontal'),
      });
  return ui.Panel([ColorBar(estilo_imagen.palette), labelPanel]);
}

function graficar_escala(valor_inicial, valor_final) {
panel_auxiliar2.clear()
//panel_auxiliar2.add(ui.Label("Leyenda", estilo_leyenda))
panel_auxiliar2.add(leyenda(valor_inicial,valor_final))
  
}
   
  


var estilo1 = {shown: true, color: "white",backgroundColor: "#35373a", stretch : "horizontal",textAlign: "justify"} 
var estilo2 = {shown: true, color: "black",backgroundColor: "#35373a", stretch : "horizontal",textAlign: "justify"} 
var estilo3 = {shown: true, color: "black",backgroundColor: "#35373a", stretch : "both",textAlign: "justify"} 
var estilo4 = {color: "black", stretch : "both",textAlign: "justify",fontWeight: "bold",fontSize: "12px"  } 
var estilo_apagado = {shown: false, color: "D5CFCF",backgroundColor: "#35373a", stretch : "both",textAlign: "justify"} 
var estilo_fechas_apagado = {shown: false, color: "black", backgroundColor: "#35373a", width:"100px", textAlign: "justify"} 
var estilo_fechas = {shown: true, color: "black", backgroundColor: "#35373a", width:"100px", textAlign: "justify"} 
var estilo_widgets = {width: '230px', position: 'bottom-left', fontWeight: 'bold',fontSize: '15px',color: "white", backgroundColor: "#35373a" }

var terminos_url = ui.Label({value: "Terminos de uso", style: {color: "white",backgroundColor: "#35373a",  padding: "0px 0px 0px 50px"}})
terminos_url.setUrl("https://earthengine.google.com/terms/" );
var ingreso_id = ui.Textbox({placeholder: "Ingrese datos", style: estilo3})

var que_mision = ui.Select({
      items: Object.keys(lista_satelites),
      disabled: false,
      style: estilo3,
      placeholder: 'Sentinel_2',
      value: lista_satelites["Sentinel_2"][0],
      onChange:   function() {
      print(lote.area(10))
      
      if(lote.area(10).getInfo !== 0){
       
        renovar_fechas()}
      //main.remove(1,panel_fechas)
      //main.insert(1,panel_fechas)
            }
    });

var boton_dibujar = ui.Button({
  label: 'Dibujar lote',
  style: estilo_apagado,
  onClick: function() {
  dibujarlote();
  }
});

var boton = ui.Button({
  label: 'Ingresar datos',
  style: estilo3,
  onClick: function() {
    var text = ingreso_id.getValue()
    var Features = ee.FeatureCollection([])
    var Feature1 = ee.FeatureCollection([])
    var lista = ee.List(text.split(" "));
    var tamaño = lista.size()
    var serverList = ee.List.sequence(0,tamaño.subtract(1));
    
    var ft = ee.FeatureCollection([])
    
    //serverList = serverList.map
    var sacapunto = function(n, ini) {
    var inift = ee.FeatureCollection(ini)  
    var feature = ee.String(lista.get(n))
    var feature2 = feature.split("\t");
    var featureX = ee.Number.parse(feature2.get(0))
    var featureY = ee.Number.parse(feature2.get(1))
    var featureZ = ee.Number.parse(feature2.get(2))
    var geometria_lista = ee.List([featureX,featureY])
    var punto = ee.Geometry.Point([featureX, featureY]);
    var Feature = ee.Feature(punto, {"profundida": featureZ});
    Feature1 = ee.FeatureCollection(Feature)
    return inift.merge(Feature1);
    }
    
// Iterates over the ImageCollection
pts = ee.FeatureCollection(serverList.iterate(sacapunto, ft))
var withRandom = pts.randomColumn('random');

var split = 0.7;  // Roughly 70% training, 30% testing.
pts = withRandom.filter(ee.Filter.lt('random', split));
pts_validacion = withRandom.filter(ee.Filter.gte('random', split));


Map.addLayer(pts, {color: '0514FA'}, 'Datos Entrenamiento')
Map.addLayer(pts_validacion, {color: 'F21B0D'}, 'Datos Validacion')
Map.centerObject(pts,15)
boton_dibujar.style().set(estilo3)

  }
});


var inspectorPanel = ui.Panel({style: {width: '30%',position:"bottom-left" }});
var panel_auxiliar2 = ui.Panel({style: {width: '30%',position:"bottom-right" }});

var panel_inicio =  ui.Panel({
  widgets: [ 
  ui.Label({
        value: "Esta app permite establecer relaciones entre puntos de muestreo e imagenes satelitales. Desarrollado en INTA Bordenave. " + 
        "Contacto: frolla.franco@inta.gob.ar",
        style: estilo1, 
      }),
      terminos_url,
      que_mision,
      ingreso_id,
      boton,
      boton_dibujar,
      ],
    style: estilo_widgets,
    layout: ui.Panel.Layout.flow('vertical'),
    })



var boton_iniciar = ui.Button({
  label: 'Iniciar',
  style: estilo_apagado,
  onClick: function() {
  
  inspectorPanel.clear()
  var año_i = ee.Number.parse(select_años.getValue());
  var año_f = ee.Number.parse(select_años_f.getValue());
  var mes_i = select_meses.getValue();
  var mes_f = select_meses_f.getValue();
  
  var a = (ee.List(meses[[mes_i]]))
  var b = (ee.List(meses[[mes_f]]))
  mes_i = a.get(0)
  mes_f = b.get(0)
  

  //randomForest =(año_inicio,año_fin,mes_inicio,mes_final,graficar)
  randomForest(año_i,año_f,mes_i,mes_f,true)
  }
});


var boton_estadisticos = ui.Button({
  label: 'Calcular estadisticos',
  style: estilo_apagado,
  disabled: true,
  onClick: function() {
    boton_estadisticos.setLabel("Calculando...")
    var rmse = rmse_calculo()
    print("hoa", rmse)
    var r_pearson = pearson()
    r_pearson = r_pearson.multiply(100).round().divide(100)
    rmse = rmse.round()
    rmse = ee.Algorithms.String(rmse)
    var rmse_print =ui.Label({value: "Calculando....(5 min demora aproximada)", style: estilo4})
    var rmse_print1 =ui.Label({value: "Desviación de la raíz cuadrada media (Datos validación): ", style: estilo4})
    var pearson_print =ui.Label({value: "Coeficiente de correlación (R²) (Datos entrenamiento):", style: estilo4})
    var pearson_print1 =ui.Label({value: "Calculando....(20 seg demora aproximada)", style: estilo4})
    
    var rmse_cliente = rmse.evaluate(function(value){rmse_print.setValue(value+" cm")});
    var pearson_cliente = r_pearson.evaluate(function(value){pearson_print1.setValue(value)});
   
    inspectorPanel.add(pearson_print);
    inspectorPanel.add(pearson_print1);
    inspectorPanel.add(rmse_print1);
    inspectorPanel.add(rmse_print);
    
    boton_estadisticos.setLabel("Calcular estadisticos")
  }
});

var boton_descargas = ui.Button({
  label: 'Generar link descargas',
  style: estilo_apagado,
  onClick: function() {
   var region = lote.toGeoJSONString(); 
   
   var url = classified.select('classification').getDownloadURL({name: "Mapa",scale: 10, region: region }) 
   
  var a = classified.getThumbURL({
    params: {
    bands:   ['classification'],
    min: visParams ['max'],
    max: visParams ['min'],
    palette: visParams ['palette'],
    dimensions: '640x480',
    region: lote.toGeoJSON(),
    format: 'jpeg'
     },
  });

  descarga1.style().set({shown: true, color: "white",backgroundColor: "#35373a",  padding: "0px 0px 0px 30px"})
  descarga.setUrl(url);
  descarga.style().set({shown: true, color: "white",backgroundColor: "#35373a",  padding: "0px 0px 0px 30px"})
  descarga1.setUrl(a)

   
  
  }
});


var descarga = ui.Label({value: "Descarga mapa (tiff)", style: estilo_apagado })
descarga.setUrl("https://earthengine.google.com/" );
var descarga1 = ui.Label({value: "Descarga mapa (jpeg)", style: estilo_apagado })
descarga1.setUrl("https://earthengine.google.com/" );



var panel_iniciar =  ui.Panel({
  widgets: [ 
   boton_iniciar,
   boton_estadisticos,
   boton_descargas,
   descarga,
   descarga1,
      ],
    style: estilo_widgets,
    layout: ui.Panel.Layout.flow('vertical'),
    })



    
var main = ui.Panel({
    widgets: [
      panel_inicio,
      //panel_fechas,
      panel_iniciar,
      ],
    style: {width: '260px', padding: '8px', color: "white", backgroundColor: "#35373a"}
  });

Map.add(inspectorPanel) 
Map.add(panel_auxiliar2)
ui.root.insert(0, main);

