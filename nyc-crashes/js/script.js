var colorScheme = ["#C39BD3","#7FB3D5","#76D7C4","#7DCEA0", "#F7DC6F","#F0B27A"];
var stackPlot_rawData = [];
var stackPlot_nestedData;
var stackPlot_percentageData = [];
var stackPlot_totals = [];
var stackPlot_fatalityData;
var keys = [];

var timeParse = d3.timeParse("%H");
var format =  d3.timeFormat("%I %p");

var smallPlots_data = [];
var smallPlots_formattedData = [];
var smallPlots_fatalityData;

var map_svgs = [d3.select("#TRUCK"), d3.select("#BIKE"), d3.select("#TAXI"), d3.select("#BUS"), d3.select("#CAR"), d3.select("#SUV")];
var map_rawData = [];
var map_nestedData;
var map_geoData;


function filterCategory(vehicle) {
	if (vehicle == "OTHER" || vehicle == "UNKNOWN" || vehicle == "FIRE TRUCK" || vehicle == "AMBULANCE") {
		// Lumped emergency vehicles with "Other" b/c the sliver is too small to be seen
		return "OTHER / UNKNOWN";
	}
	if (vehicle == "LARGE COM VEH(6 OR MORE TIRES)" || vehicle == "SMALL COM VEH(4 TIRES)") {
		return "COMMERCIAL TRUCK";
	}
	if (vehicle == "MOTORCYCLE" || vehicle == "SCOOTER" || vehicle == "BICYCLE") {
		return "MOTORCYCLE / SCOOTER / BIKE";
	}
	if (vehicle == "LIVERY VEHICLE" || vehicle == "TAXI" || vehicle == "PEDICAB") {
		return "TAXI / LIMO / PEDICAB";
	}
	if (vehicle == "SPORT UTILITY / STATION WAGON" || vehicle == "VAN" || vehicle == "PICK-UP TRUCK") {
		return "SUV / PICK-UP / VAN";
	}
	return vehicle;
}

function parseHour(line) {
	// Get hour as a number from 0-23
	return line["TIME"].length == 4 ? line["TIME"].substring(0, 1) : line["TIME"].substring(0, 2);
}

function parseLine (line) {
	var hr = parseHour(line);
	return {
		Vehicles: [
			{
				Hour: hr, 
				Vehicle: filterCategory(line["VEHICLE 1 TYPE"]),
				LATITUDE: line["LATITUDE"],
				LONGITUDE: line["LONGITUDE"],
				totalKilled: line["PERSONS KILLED"],
			}, 
			{
				Hour: hr, 
				Vehicle: filterCategory(line["VEHICLE 2 TYPE"]),
				LATITUDE: line["LATITUDE"],
				LONGITUDE: line["LONGITUDE"],
				totalKilled: line["PERSONS KILLED"],
			},
			{
				Hour: hr, 
				Vehicle: filterCategory(line["VEHICLE 3 TYPE"]),
				LATITUDE: line["LATITUDE"],
				LONGITUDE: line["LONGITUDE"],
				totalKilled: line["PERSONS KILLED"],
			},
			{
				Hour: hr, 
				Vehicle: filterCategory(line["VEHICLE 4 TYPE"]),
				LATITUDE: line["LATITUDE"],
				LONGITUDE: line["LONGITUDE"],
				totalKilled: line["PERSONS KILLED"],
			},
			{
				Hour: hr, 
				Vehicle: filterCategory(line["VEHICLE 5 TYPE"]),
				LATITUDE: line["LATITUDE"],
				LONGITUDE: line["LONGITUDE"],
				totalKilled: line["PERSONS KILLED"],
			}
		],
	}
}

d3.csv("data/database.csv", parseLine, function(error, data) {
	/* -------------- STACK PLOT -------------- */
	// Read in CSV file
	data.forEach(function (d) {
		d["Vehicles"].forEach(function (e) {
			if (e.Vehicle != "") {
				stackPlot_rawData.push(e);
			}
		});
	});
	stackPlot_nestedData = d3.nest()
	.key(function (d) { return d.Hour; })
	.key(function (d) { return d.Vehicle; })
	.rollup(function (v) { 
		return v.length;
	})
	.entries(stackPlot_rawData);

	stackPlot_fatalityData = d3.nest()
	.key(function (d) { return d.Hour; })
	.rollup(function (v) {
		var totalKilled = 0;
		v.forEach(function (d) {
			totalKilled += Number(d.totalKilled);
		})
		return totalKilled;
	})
	.entries(stackPlot_rawData);

	showStackPlot();

	/* -------------- MAPS -------------- */
	map_nestedData = d3.nest()
	.key(function (d) { return d.Vehicle; })
	.entries(stackPlot_rawData);
	map_nestedData.splice(2,1); // Get rid of Other / Unknown

	showMap();

	/* -------------- SMALL PLOTS -------------- */
	keys.forEach(function (key) {
		if (key != "OTHER / UNKNOWN") {
			var entry = {}
			entry[key] = {};
			for (var i = 0; i < 24; i++) {
				entry[key][i] = stackPlot_percentageData[i][key];
			}
			smallPlots_data.push(entry);
		}
	});

	smallPlots_fatalityData = d3.nest()
	.key(function (d) { return d.Vehicle })
	.key(function (d) { return d.Hour })
	.rollup(function (v) {
		var sum = 0;
		v.forEach(function (e) {
			sum += Number(e.totalKilled);
		});
		return sum;
	})
	.entries(stackPlot_rawData);
	smallPlots_fatalityData.splice(2,1);

	showSmallPlots();

});

var projection = d3.geoAlbersUsa().scale(75);
var pathGenerator = d3.geoPath().projection(projection);

// Display maps of NYC
// Basemap source: http://bl.ocks.org/phil-pedruco/6646844
d3.json("data/nyc.json", function(error, data) {
	map_geoData = data;
});


function showStackPlot() {
	// Partially adapted from https://bl.ocks.org/mbostock/3885211
	var svg = d3.select("#stackPlot svg");
	var margin = {top: 40, right: 200, bottom: 40, left: 50};
	var width = svg.attr("width") - margin.left - margin.right;
	var height = svg.attr("height") - margin.top - margin.bottom;

	var x = d3.scaleTime().range([0, width]);
	var y = d3.scaleLinear().range([height, 0]);
	var z = d3.scaleOrdinal(d3.schemeCategory20c).range(colorScheme);

	var stack = d3.stack();

	var area = d3.area()
	.x(function(d, i) { return x(timeParse(d.data.hour)); })
	.y0(function(d) { return y(d[0]); })
	.y1(function(d) { return y(d[1]); })

	var g = svg.append("g")
	.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	// Get all vehicle types as array of keys
	keys = [];
	d3.nest().key(function (d) { return d.Vehicle; })
	.entries(stackPlot_rawData).forEach(function (e) {
		keys.push(e.key);
	});

	// put unknown at end
	var unknown = keys.splice(2, 1);
	keys.push(unknown[0]); 
	unknown = stackPlot_nestedData.splice(2,1);
	stackPlot_nestedData.push(unknown[0]);

	// Sort nestedData so hours are in order
	stackPlot_nestedData.sort(function(a, b) {
		var keyA = Number(a.key);
		var keyB = Number(b.key);
		if (keyA > keyB) return 1;
		if (keyB > keyA) return -1;
		return 0;
	});

	// Calculate total crashes per hour
	stackPlot_nestedData.forEach(function (d) {
		var sum = 0;
		var values = Object.keys(d).map(function(key) {
			return d[key];
		});
		values[1].forEach(function (e) {
			sum += e.value;
		});
		
		stackPlot_totals.push(sum);
	});

	// Calculate percentages of each vehicle type
	stackPlot_nestedData.forEach(function(d) {
		var obj = {};
		obj["hour"] = d.key;
		d.values.forEach(function(e) {
			obj[e.key] = e.value;
		});
		keys.forEach(function(e) {
			if (!(obj.hasOwnProperty(e))) obj[e] = 0;
		});
		stackPlot_percentageData.push(obj);
	});

	// Add shapes
	x.domain([timeParse(0), timeParse(23)]);
	y.domain([0, d3.extent(stackPlot_totals)[1]]);
	stack.keys(keys);

	var layer = g.selectAll(".layer")
	.data(stack(stackPlot_percentageData))
	.enter().append("g").attr("class", "layer");

	layer.append("path")
	.attr("class", "area")
	.style("fill", function(d) { 
		if (d.key == "OTHER / UNKNOWN") return "gray";
		return z(d.key); 
	})
	.attr("d", area);

	// Axes
	g.append("g")
	.attr("class", "axisWhite")
	.attr("transform", "translate(0," + height + ")")
	.call(d3.axisBottom(x).ticks(10, "%I %p"))
	.attr("font-family", "Oswald");

	g.append("g")
	.attr("class", "axisWhite")
	.call(d3.axisLeft(y).ticks(10, "s"))
	.attr("font-family", "Oswald");

	// Legend
	var legend = svg.append("g")
	.attr("class", "axisWhite")
	.attr("transform", "translate(0, " + height + ")" );

	legend.selectAll(".legend")
	.data(keys).enter().append("rect")
	.attr("height", 10).attr("width", 10)
	.attr("transform", function(d) { return "translate(565, " + (keys.indexOf(d) * -20) + ")"; })
	.attr("fill", function(d) { 
		if (d == "OTHER / UNKNOWN") return "gray";
		return z(d); });

	legend.selectAll(".legend").data(keys).enter().append("text")
	.text(function (d) { return d; })
	.attr("x", 580)
	.attr("y", function(d) { return (keys.indexOf(d) * -20); })
	.attr("font-size", 10)
	.attr("dominant-baseline", "hanging");

	svg.append("path")
	.attr("stroke", "crimson")
	.attr("stroke-width", 3)
	.attr("opacity", .7)
	.attr("d", "M 565 100 L 575 100");
	svg.append("text")
	.text("# FATALITIES")
	.attr("x", 580)
	.attr("y", 104)
	.attr("font-size", 10);

	// Label interesting patterns - number of collisions and fatalities
	svg.append("path")
	.attr("stroke", "crimson")
	.attr("d", "M" + (margin.left + 2) + " " + (margin.top - 2)
	 + "L" + (x(timeParse("08")) + margin.left - 2) + " " + (margin.top - 2));
	svg.append("text")
	.text("Few Collisions, More Fatalities")
	.attr("x", margin.left)
	.attr("y", margin.top - 5)
	.attr("font-size", 12);

	svg.append("path")
	.attr("stroke", "#fff")
	.attr("d", "M" + (x(timeParse("08")) + margin.left + 2) + " " + (margin.top - 2)
		+ "L" + (x(timeParse("17")) + margin.left - 2) + " " + (margin.top - 2));
	svg.append("text")
	.text("Few Fatalities, More Collisions")
	.attr("x", x(timeParse("08")) + margin.left + 5)
	.attr("y", margin.top - 5)
	.attr("font-size", 12);

	svg.append("path")
	.attr("stroke", "crimson")
	.attr("d", "M" + (x(timeParse("17")) + margin.left + 2) + " " + (margin.top - 2)
	 + "L" + (x(timeParse("23")) + margin.left - 2) + " " + (margin.top - 2));
	svg.append("text")
	.text("More Fatalities")
	.attr("x", x(timeParse("17")) + margin.left + 5)
	.attr("y", margin.top - 5)
	.attr("font-size", 12);

	svg.append("text")
	.text("Total Vehicles in Collisions")
	.attr("font-size", 12)
	.attr("transform", "rotate(-90),translate(-230, 20)");

	// Add number of fatalities
	var fatalities = [];
	stackPlot_fatalityData.forEach(function (d) { fatalities.push(d.value); });
	var fatalityScale = d3.scaleLinear().domain(d3.extent(fatalities)).range([height, 0]);

	stackPlot_fatalityData.forEach(function (d) {
		g.append("path")
		.attr("d", "M" + x(timeParse(d.key)) + " " + y(0) + " L " + x(timeParse(d.key)) + " " + fatalityScale(d.value))
		.attr("stroke", "crimson")
		.attr("stroke-width", 3)
		.attr("opacity", .7);
	});

	g.append("g")
	.attr("class", "axisWhite")
	.call(d3.axisRight(fatalityScale).ticks(10, "s"))
	.attr("font-family", "Oswald")
	.attr("transform", "translate(" + width + ")");

	svg.append("text")
	.text("Number of Fatalities")
	.attr("font-size", 12)
	.attr("transform", "rotate(90),translate(130, -525)");
}


function showSmallPlots() {
	var div = d3.select("#smallPlots");
	var margin = {top: 40, right: 20, bottom: 40, left: 50};
	var height = 175;
	var width = 230;
	var plotHeight = height - (margin.top + margin.bottom);
	var plotWidth = width - (margin.right + margin.left); 

	var x = d3.scaleTime().domain([timeParse(0), timeParse(23)]).range([0, plotWidth]);
	var y = d3.scaleLinear().range([plotHeight, 0]);
	var z = d3.scaleOrdinal(d3.schemeCategory20c).range(colorScheme);

	smallPlots_data.forEach(function(d) {
		var area = d3.area()

		.x(function(d, i) { return x(timeParse(i)); })
		.y0(function(d) { return y(0); })
		.y1(function(d) { return y(d); });

		var svg = div.append("svg")
		.attr("height", height)
		.attr("width", width);

		var values1 = Object.keys(d).map(function(key) {
	 			return d[key];
		}); 
		var values = Object.keys(values1[0]).map(function(key) {
	 			return values1[0][key];
		}); 

		x.domain([timeParse(0), timeParse(23)]);
		y.domain([0, d3.extent(values)[1]]);

		var g = svg.append("g")
		.attr("width", plotWidth)
		.attr("height", plotHeight)
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		g.append("path")
		.datum(values)
		.attr("d", area)
		.attr("fill", function(d) { return z(d); });

		// Axes
		g.append("g")
		.attr("class", "axisWhite")
		.attr("transform", "translate(0," + plotHeight + ")")
		.call(d3.axisBottom(x).ticks(4, "%I %p"))
		.attr("font-family", "Oswald");

		g.append("g")
		.attr("class", "axisWhite")
		.call(d3.axisLeft(y).ticks(5, "s"))
		.attr("font-family", "Oswald");

		// Plot Titles
		svg.append("text")
		.text(Object.keys(d)[0])
		.attr("x", margin.left)
		.attr("y", margin.top - 15)
		.attr("font-size", 10);	

		// Label peak time
		var max = Math.max.apply(null, values); // highest
		var time = timeParse(values.indexOf(max));
		var format = d3.timeFormat("%I %p");

		g.append("circle")
		.attr("fill", "white")
		.attr("r", 3)
		.attr("cx", x(time))
		.attr("cy", y(max));
		
		g.append("text")
		.text(format(time))
		.attr("x", x(time) + 5)
		.attr("y", y(max))
		.attr("font-size", 12)
		.attr("dominant-baseline", "middle");

		var thisVehicle = smallPlots_fatalityData[smallPlots_data.indexOf(d)];
		var smallPlotFatalities = Object.keys(thisVehicle).map(function (key) {
			return thisVehicle[key];
		})
		smallPlotFatalities = smallPlotFatalities[1];
		
		var fatalityScale = d3.scaleLinear().domain([0,4]).range([plotHeight, 0]);
		
		smallPlotFatalities.forEach(function (d) {
			g.append("path")
			.attr("d", "M" + x(timeParse(d.key)) + " " + y(0) + " L " + x(timeParse(d.key)) + " " + fatalityScale(d.value))
			.attr("stroke", "crimson")
			.attr("stroke-width", 3)
			.attr("opacity", .7);
		});

		g.append("g")
		.attr("class", "axisWhite")
		.call(d3.axisRight(fatalityScale).ticks(5, "s"))
		.attr("font-family", "Oswald")
		.attr("transform", "translate(" + plotWidth + ")");

	});


}


function showMap() {
	var text = [
		"SUV / PICK-UP / VAN",
		"PASSENGER VEHICLE", 
		"BUS",
		"TAXI / LIMO / PEDICAB", 
		"MOTORCYCLE / SCOOTER / BIKE",  
		"COMMERCIAL TRUCK", 
	];

	var color = d3.scaleOrdinal(d3.schemeCategory20c).range(colorScheme);
	var timeScale = d3.scaleSequential(d3.interpolateInferno);

	// Map Legend
	var g = d3.select("#maps .legend").append("g")
	.attr("width", 500)
	.attr("height", 20);

	var rect = g.append("rect")
	.attr("fill", "#fff")
	.attr("opacity", 0.4)
	.attr("width", 330)
	.attr("height", 20);

	colorScheme.forEach(function(d) {
		g.append("circle")
		.attr("fill", d).attr("r", 2)
		.attr("cx", function() {return 10 + ((colorScheme.indexOf(d) % 3)*5)})
		.attr("cy", function() {
			if (colorScheme.indexOf(d) < 3) return 7;
			return 13;
		});
	});
	g.append("text").text("Collision")
	.attr("x", 25).attr("y", 11)
	.attr("font-size", 12)
	.attr("dominant-baseline", "middle");

	g.append("circle")
	.attr("fill", "yellow").attr("stroke", "crimson").attr("r", 3)
	.attr("cx", 80).attr("cy", 10);
	g.append("text").text("Fatal Collision")
	.attr("x", 85).attr("y", 11)
	.attr("font-size", 12)
	.attr("dominant-baseline", "middle");

	var times = [0, 6, 12, 18, 23];
	for (var i = 0; i < 5; i++) {

		g.append("rect")
		.attr("fill", timeScale(times[i] / 24))
		.attr("width", 20)
		.attr("height", 10)
		.attr("x", 160 + 20*i)
		.attr("y", 5);

		g.append("text")
		.attr("class", function(d) {
			if (i == 4) return "grayText";
		})
		.attr("x", 160 + 20*i)
		.attr("y", 14)
		.attr("font-size", 8)
		.text(format(timeParse(times[i])));

	}

	g.append("text")
	.text("Time of Day")
	.attr("x", 265)
	.attr("y", 11)
	.attr("font-size", 12)
	.attr("dominant-baseline", "middle");


	// Make maps
	for (var i = 0; i < 6; i++) {
		var svg = map_svgs[i];
		projection.fitExtent([[10,10], [svg.attr("width")-30, svg.attr("height")-30]], map_geoData);

		var g = svg.append("g");
		g.append("g")
		.attr("id", "boroughs")
		.selectAll(".state")
		.data(map_geoData.features)
		.enter().append("path")
		.attr("class", function(d){ return d.properties.name; })
		.attr("d", pathGenerator);

		svg.append("text")
		.attr("x", "200")
		.attr("y", "320")
		.text(text[i])
		.style("dominant-baseline", "center")
		.style("text-anchor", "end")
		.style("font-size", 16);

		var mapData = map_nestedData[i];
		var values = Object.keys(mapData).map(function(key) {
				 return mapData[key];
		});
		var data = values[1];

		var filter = data.filter(function (d) { return d.LATITUDE && d.LONGITUDE; });
		filter.sort(function (a, b) {
			if (Number(a.totalKilled) > Number(b.totalKilled)) return -1;
			if (Number(a.totalKilled) < Number(b.totalKilled)) return 1;
			return 0;
		});
		var filter_subset = filter.splice(0, filter.length/20); // 5% of the total
		filter_subset.reverse(); // puts fatality circles on top

		var circles = svg.selectAll("circle").data(filter_subset);

		circles.enter().append("circle")
		.merge(circles)
		.attr("r", function(d) {
			if (d.totalKilled > 0) return 3;
			return 1;
		})
		.attr("cx", function(d) { 
			var coords = [Number(d.LONGITUDE), Number(d.LATITUDE)];
			return projection(coords)[0]; 
		})
		.attr("cy", function(d) { 
			var coords = [Number(d.LONGITUDE), Number(d.LATITUDE)];
			return projection(coords)[1];  
		})
		.attr("fill", function(d) {
			if (d.totalKilled > 0) {
				return timeScale(Number(d.Hour) / 24);
			}
			return color(d.Vehicle);
		})
		.attr("stroke", function (d) {
			if (d.totalKilled > 0) {
				return "crimson";
			}
		})
		.attr("opacity", 0.7);


	}
}