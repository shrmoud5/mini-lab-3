//adapted from the cerner smart on fhir guide. updated to utalize client.js v2 library and FHIR R4

// helper function to process fhir resource to get the patient name.
function getPatientName(pt) {
  if (pt.name) {
    var names = pt.name.map(function(name) {
      return name.given.join(" ") + " " + name.family;
    });
    return names.join(" / ")
  } else {
    return "anonymous";
  }
}

// display the patient name gender and dob in the index page
function displayPatient(pt) {
  document.getElementById('patient_name').innerHTML = getPatientName(pt);
  document.getElementById('gender').innerHTML = pt.gender;
  document.getElementById('dob').innerHTML = pt.birthDate;
}

function displayChart(data, low_data, high_data) {
  var ctx = document.getElementById("myChart").getContext("2d");
  var MyNewChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Weight Changes During the First 96 Hours of Life in Full‐Term Newborns',
        fillColor: "rgba(220,220,220,0.2)",
        strokeColor: "rgba(220,220,220,1)",
        pointColor: "rgba(220,220,220,1)",
        pointStrokeColor: "#000",
        pointHighlightFill: "#000",
        pointHighlightStroke: "rgba(220,220,220,1)",
        data: data
      },
      {
        label: 'Upper Limit First 96 Hours of Life in Full‐Term Newborns',
        fillColor: "rgba(0,220,220,0.2)",
        strokeColor: "rgba(0,220,220,1)",
        pointColor: "rgba(0,220,220,1)",
        pointStrokeColor: "#008",
        pointHighlightFill: "#008",
        pointHighlightStroke: "rgba(0,220,220,1)",
        data: low_data
      },
      {
        label: 'Lower Limit First 96 Hours of Life in Full‐Term Newborns',
        fillColor: "rgba(0,220,0,0.2)",
        strokeColor: "rgba(0,220,0,1)",
        pointColor: "rgba(0,220,0,1)",
        pointStrokeColor: "#008",
        pointHighlightFill: "#008",
        pointHighlightStroke: "rgba(0,220,0,1)",
        data: high_data
      },
    ]},
    options: {
      scales: {
        xAxes: [{
          type: 'linear',
          position: 'bottom'
        }]
      }
    }
  });
}

//function to display list of medications
function displayMedication(meds) {
  med_list.innerHTML += "<li> " + meds + "</li>";
}

function displayWeight(weight) {
  weight_list.innerHTML += "<li> " + weight.valueQuantity.value + " " + weight.valueQuantity.unit + " on " + weight.issued + "</li>";
}

//helper function to get quanity and unit from an observation resoruce.
function getQuantityValueAndUnit(ob) {
  if (typeof ob != 'undefined' &&
    typeof ob.valueQuantity != 'undefined' &&
    typeof ob.valueQuantity.value != 'undefined' &&
    typeof ob.valueQuantity.unit != 'undefined') {
    return Number(parseFloat((ob.valueQuantity.value)).toFixed(2)) + ' ' + ob.valueQuantity.unit;
  } else {
    return undefined;
  }
}

// helper function to get both systolic and diastolic bp
function getBloodPressureValue(BPObservations, typeOfPressure) {
  var formattedBPObservations = [];
  BPObservations.forEach(function(observation) {
    var BP = observation.component.find(function(component) {
      return component.code.coding.find(function(coding) {
        return coding.code == typeOfPressure;
      });
    });
    if (BP) {
      observation.valueQuantity = BP.valueQuantity;
      formattedBPObservations.push(observation);
    }
  });

  return getQuantityValueAndUnit(formattedBPObservations[0]);
}

// create a patient object to initalize the patient
function defaultPatient() {
  return {
    height: {
      value: ''
    },
    weight: {
      value: ''
    },
    sys: {
      value: ''
    },
    dia: {
      value: ''
    },
    note: 'No Annotation',
  };
}

//helper function to display the annotation on the index page
function displayAnnotation(annotation) {
  note.innerHTML = annotation;
}

//function to display the observation values you will need to update this
function displayObservation(obs) {
  sys.innerHTML = obs.sys;
  dia.innerHTML = obs.dia;
  height.innerHTML = obs.height;
  weight.innerHTML = obs.weight;
}

//once fhir client is authorized then the following functions can be executed
FHIR.oauth2.ready().then(function(client) {

  // get patient object and then display its demographics info in the banner
  client.request(`Patient/${client.patient.id}`).then(
    function(patient) {
      displayPatient(patient);
      console.log(patient);
    }
  );

  // get observation resoruce values
  // you will need to update the below to retrive the weight and height values
  var query = new URLSearchParams();

  query.set("patient", client.patient.id);
  query.set("_count", 100);
  query.set("_sort", "date");
  query.set("code", [
    'http://loinc.org|8462-4',
    'http://loinc.org|8480-6',
    'http://loinc.org|55284-4',
    'http://loinc.org|8302-2',
    'http://loinc.org|29463-7',
    'http://loinc.org|66149-6',
  ].join(","));

  client.request("Observation?" + query, {
    pageLimit: 0,
    flat: true
  }).then(
    function(ob) {

      // group all of the observation resoruces by type into their own
      var byCodes = client.byCodes(ob, 'code');
      var systolicbp = getBloodPressureValue(byCodes('55284-4'), '8480-6');
      var diastolicbp = getBloodPressureValue(byCodes('55284-4'), '8462-4');
      var weight = byCodes('29463-7');
      var height = byCodes('8302-2');
      var med = byCodes('66149-6');
      console.log(weight);

      // create patient object
      var p = defaultPatient();

      // set patient value parameters to the data pulled from the observation resoruce
      if (typeof systolicbp != 'undefined') {
        p.sys = systolicbp;
      } else {
        p.sys = 'undefined'
      }

      if (typeof diastolicbp != 'undefined') {
        p.dia = diastolicbp;
      } else {
        p.dia = 'undefined'
      }
      p.weight = getQuantityValueAndUnit(weight[0]);
      p.height = getQuantityValueAndUnit(height[0]);

      displayObservation(p);

      var hours = [];
      var nwc = [];
      var bw = 0;
      var last_dt;
      var data = [];
      var high_data = [];
      var low_data = [];
      weight.forEach(function weight_change(item, index, array) {
        displayWeight(item);
        if (index === 0) {
          hours.push(0);
          nwc.push(0);
          bw=item.valueQuantity.value;
          last_dt = new Date(item.issued);
          data.push({x: 0, y: 0});
        } else {
          item_dt = new Date(item.issued);
          var hour_diff = Math.abs(item_dt-last_dt) / 36e5;
          hours.push(hour_diff);
          nwc_diff = ((item.valueQuantity.value - bw) / (bw)) * 100;
          nwc.push(nwc_diff);
          last_dt = item_dt;
          data.push({x: hour_diff, y: nwc_diff});
        }
      });
      high_data.push({x: 0, y: bw});
      low_data.push({x: 0, y: bw});
      var high_diff = bw - (bw * 0.042);
      var low_diff = bw - (bw * 0.091);
      high_data.push({x: 120, y: high_diff});
      low_data.push({x: 120, y: low_diff});
      console.log(high_data);
      console.log(low_data);
      console.log(data);
      displayChart(data, low_data, high_data);
    });

   // Medication requests
   var med_query = new URLSearchParams();
    med_query.set("patient", client.patient.id);
    client.request('MedicationRequest?' + med_query, {
        resolveReferences: "medicationReference"
    }).then(function(meds) {
      meds.entry.forEach(function(med) {
        if (med.resource.medicationCodeableConcept) {
          displayMedication(med.resource.medicationCodeableConcept.text);
          }
      })
    });

  //event listner when the add button is clicked to call the function that will add the note to the weight observation
  document.getElementById('add').addEventListener('click', addWeightAnnotation);

  // var resource = {
  //   resourceType: "Observation",
  //   text: {
  //     status: "generated",
  //     div:
  //       '<div xmlns="http://www.w3.org/1999/xhtml"><p>Number of steps in 24 hr</p></div>',
  //   },
  //   status: "final",
  //   code: {
  //     coding: [
  //       {
  //         system: "http://loinc.org",
  //         code: "29463-7",
  //         display: "Body weight",
  //       },
  //     ],
  //   },
  //   subject: {
  //     reference: `Patient/${client.patient.id}`,
  //     display: `${client.patient?.name[0].given[0]} ${client.patient?.name[0].family}`,
  //   },
  //   effectivePeriod: {
  //     start: "2020-11-29T09:30:10+01:00",
  //   },
  //   issued: new Date(),
  //   valueInteger: stepCount,
  // };
  // client.create({resource: resource}).done(function(r));

}).catch(console.error);
