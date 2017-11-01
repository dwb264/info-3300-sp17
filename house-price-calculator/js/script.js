// Smooth scrolling
// Source: https://css-tricks.com/snippets/jquery/smooth-scrolling/
$(function() {
  $('a[href*="#"]:not([href="#"])').click(function() {
    if (location.pathname.replace(/^\//,'') == this.pathname.replace(/^\//,'') && location.hostname == this.hostname) {
      var target = $(this.hash);
      target = target.length ? target : $('[name=' + this.hash.slice(1) +']');
      if (target.length) {
        $('html, body').animate({
          scrollTop: target.offset().top
        }, 1000);
        return false;
      }
    }
  });
});

// Load house data
var rawData;
var coefficients = {};

d3.queue()
.defer(d3.csv, "data/kc_house_data.csv")
.defer(d3.tsv, "data/coefficients.txt")
.await(function(error, data, coeffs) {
	rawData = data.filter(function(d) { return Number(d["bedrooms"]) < 33; }); // Remove outlier w/33 bedrooms
	coefficients = coeffs[0];
	showHouse();
	showHouseStats();
	showHistogramsKC();
});

// Return the extent of a numerical variable from the dataset
function houseDataExtent(x) {
	var array = [];
	if (x != "yr_renovated") {
		rawData.forEach(function(d) { array.push(Number(d[x])); });
	} else {
		rawData.forEach(function(d) { if (Number(d[x]) != 0) array.push(Number(d[x])); });
	}
	return d3.extent(array);
}

var houseVariables = ["sqft_living15", "sqft_lot15", "sqft_basement", "floors", "yr_built", "yr_renovated", "bedrooms", "bathrooms", "view"];
var sqft_living15, sqft_lot15, sqft_basement, floors, yr_built, yr_renovated, bedrooms, bathrooms, view;
var viewqualities = ["worst", "bad", "ok", "good", "best"];

// Data ranges used in sliders and histograms
var ranges = {"price": [0, 4000000], "sqft_living15": [500, 6000], "sqft_lot15": [0, 43560], "sqft_basement": [0, 2000], "floors": [1,3], "yr_built": [1900, 2015], "yr_renovated": [1900, 2015], "bedrooms": [0, 8], "bathrooms": [0, 8], "view": [0, 4]};

// Format number string with commas between thousands
// http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Update price prediction
function pricePrediction() {
	var prediction = getPrediction();
	var text = "Current Value Estimate: $" + numberWithCommas(prediction.toFixed(2));
	if (prediction < 0) text += " (this house is unrealistic)";
	document.getElementById("priceEstimate").innerHTML = text;

}

//Calculate price prediction
function getPrediction() {
	var prediction = Number(coefficients["(Intercept)"]);
	houseVariables.forEach(function (d) {
		var value = Number(document.getElementById(d).getElementsByTagName("input")[0].value);
		prediction += Number(coefficients[d]) * value;
	})
	return prediction;
}

// Make the sliders and show the house
function showHouse() {
	houseVariables.forEach(function (d) {
		var extent = ranges[d];

		var currentValue;
		if (d == "sqft_lot15") {
			currentValue = (Math.floor(d3.mean(extent)) / 43560).toFixed(2)
		} else if (d == "view") {
			currentValue = viewqualities[2];
		}else {
			currentValue = Math.floor(d3.mean(extent));
		}

		document.getElementById(d)
		.innerHTML = (
			"<input type='range' min='" + Math.floor(extent[0]) + "' max='" + Math.floor(extent[1]) + "' value='" + Math.floor(d3.mean(extent)) + "'>"
			+ "<div class='currentValue'>" + currentValue + "</div>");
	})

	sqft_living15 = d3.select("#sqft_living15 input").attr("value");
	sqft_lot15 = d3.select("#sqft_lot15 input").attr("value");
	sqft_basement = d3.select("#sqft_basement input").attr("value");
	floors = d3.select("#floors input").attr("value");
	yr_built = d3.select("#yr_built input").attr("value");
	yr_renovated = d3.select("#yr_renovated input").attr("value");
	bathrooms = d3.select("#bathrooms input").attr("value");
	bedrooms = d3.select("#bedrooms input").attr("value");
	view = d3.select("#view input").attr("value");

	// Front view scales
	var sqftScale = d3.scaleLinear().domain([0, ranges["sqft_living15"][1]]).range([0, 600]);
	var lotScale = d3.scaleLinear().domain([0, ranges["sqft_lot15"][1]]).range([0, 200]);
	var yearScale = d3.scaleLinear().domain(ranges["yr_built"]).range([0, 100]);
	var bsmtScale = d3.scaleLinear().domain([0, ranges["sqft_basement"][1]]).range([0, 200]);

	// Top view scales
	var sqftScaleTop = d3.scaleLinear().domain([0, Math.sqrt(ranges["sqft_lot15"][1])]).range([0, 800]);

	// Top view positioning
	var leftDist = (800-sqftScale(sqft_living15))/2;

	/* House */
	var selectedView = "front"; // initially view house from front

	var frontView = d3.select("#build #front");
	var sky = frontView.append("image")
					.attr("xlink:href", "img/view-" + viewqualities[view] + ".png").attr("width", 800);
	var ground = frontView.append("rect").attr("height", 200).attr("width", 800).attr("transform", "translate(0, 300)").attr("fill", "green");
	//var sky = frontView.append("rect").attr("height", 300).attr("width", 800).attr("fill", "lightblue");

	var topView = d3.select("#build #top");
	var groundTop = topView.append("rect").attr("height", 500).attr("width", 800).attr("fill", "green");

	// Front view initial gfx
	var lot = frontView.append("rect").attr("class", "lot")
	.attr("fill", "#51b51b")
	.attr("height", lotScale(sqft_lot15))
	.attr("width", 800)
	.attr("transform", "translate(0, 300)");
	var house = frontView.append("g").attr("transform", "translate(" + leftDist + ")");
	var houseColor = d3.hsl("hsla(30, " + yearScale(yr_built) + "%, 30%, 1)");
	var bsmt = house.append("rect").attr("class", "basement")
	.attr("fill", "#000")
	.attr("width", sqftScale(sqft_living15))
	.attr("height", bsmtScale(sqft_basement))
	.attr("transform", "translate(0, 300)")
	.attr("stroke", "#fff")
	.attr("stroke-dasharray", "5 5")
	.attr("opacity", 0.5);

	// Top view initial gfx
	var lotTop = topView.append("rect")
	.attr("fill", "#51b51b")
	.attr("height", sqftScaleTop(Math.sqrt(sqft_lot15)))
	.attr("width", sqftScaleTop(Math.sqrt(sqft_lot15)))
	.attr("transform", "translate("
		+ ((800-sqftScaleTop(Math.sqrt(sqft_lot15))) / 2) + ","
		+ ((500-sqftScaleTop(Math.sqrt(sqft_lot15))) / 2) + ")"
	);
	var houseTop = topView.append("g")
	.attr("transform", "translate("
		+ ((800-sqftScaleTop(Math.sqrt(sqft_living15))) / 2) + ","
		+ ((500-sqftScaleTop(Math.sqrt(sqft_living15))) / 2) + ")"
	);
	var sqftTop = houseTop.append("rect")
	.attr("height", sqftScaleTop(Math.sqrt(sqft_living15)))
	.attr("width", sqftScaleTop(Math.sqrt(sqft_living15)))
	.attr("fill", "#fff")
	.attr("stroke", "#000")
	.attr("opacity", 0.9);

	// Zoom in and out
	var zoom = topView.append("g").attr("id", "zoomButtons");
	var zoomIn = topView.append("g").attr("transform", "translate(740, 10)");
	zoomIn.append("rect").attr("height", 50).attr("width", 50).attr("class", "zoom").style("cursor", "pointer");
	zoomIn.append("text").text("+").attr("fill", "#fff").attr("transform", "translate(10,42)").attr("font-size", 50).style("cursor", "pointer");
	var zoomOut = topView.append("g").attr("transform", "translate(740, 65)");
	zoomOut.append("rect").attr("height", 50).attr("width", 50).attr("class", "zoom").style("cursor", "pointer");
	zoomOut.append("text").text("-").attr("fill", "#fff").attr("transform", "translate(16,40)").attr("font-size", 50).style("cursor", "pointer");

	zoomIn.on("click", function() {
		sqftScaleTop = d3.scaleLinear().domain([0, Math.sqrt(ranges["sqft_living15"][1])]).range([0, 500]);

		lotTop.attr("height", sqftScaleTop(Math.sqrt(sqft_lot15)))
		.attr("width", sqftScaleTop(Math.sqrt(sqft_lot15)))
		.attr("transform", "translate("
			+ ((800-sqftScaleTop(Math.sqrt(sqft_lot15))) / 2) + ","
			+ ((500-sqftScaleTop(Math.sqrt(sqft_lot15))) / 2) + ")");

		houseTop.attr("transform", "translate("
		+ ((800-sqftScaleTop(Math.sqrt(sqft_living15))) / 2) + ","
		+ ((500-sqftScaleTop(Math.sqrt(sqft_living15))) / 2) + ")");

		sqftTop.attr("height", sqftScaleTop(Math.sqrt(sqft_living15)))
		.attr("width", sqftScaleTop(Math.sqrt(sqft_living15)));

		drawRooms();
	});

	zoomOut.on("click", function() {
		sqftScaleTop = d3.scaleLinear().domain([0, Math.sqrt(ranges["sqft_lot15"][1])]).range([0, 800]);

		lotTop.attr("height", sqftScaleTop(Math.sqrt(sqft_lot15)))
		.attr("width", sqftScaleTop(Math.sqrt(sqft_lot15)))
		.attr("transform", "translate("
			+ ((800-sqftScaleTop(Math.sqrt(sqft_lot15))) / 2) + ","
			+ ((500-sqftScaleTop(Math.sqrt(sqft_lot15))) / 2) + ")");

		houseTop.attr("transform", "translate("
		+ ((800-sqftScaleTop(Math.sqrt(sqft_living15))) / 2) + ","
		+ ((500-sqftScaleTop(Math.sqrt(sqft_living15))) / 2) + ")");

		sqftTop.attr("height", sqftScaleTop(Math.sqrt(sqft_living15)))
		.attr("width", sqftScaleTop(Math.sqrt(sqft_living15)));

		drawRooms();
	});

	// Draw the house with a given number of floors
	function drawHouse(numFloors) {
		d3.selectAll(".level").remove();
		d3.selectAll(".roof").remove();
		for (var i = 0; i < numFloors; i++) {
			house.append("rect").attr("class", "level")
			.attr("height", 80)
			.attr("width", sqftScale(sqft_living15))
			.attr("transform", "translate(0, " + (220 - (80*i)) + ")")
			.attr("fill", houseColor)
			.attr("stroke", "#000");
		}
		house.append("path").attr("class", "roof")
		.attr("d", "M -50 " + (220 - (80*(numFloors-1)))
			+ " L " + (sqftScale(sqft_living15) + 50) + " " +  (220 - (80*(numFloors-1)))
			+ " " + sqftScale(sqft_living15)/2 + " " + (180 - (80*(numFloors-1))) + " z")
		.attr("fill", "#514420");
	}

	function drawRooms() {
		var br = Number(bedrooms);
		var ba = Number(bathrooms);
		d3.select("#rooms").remove();
		var g = houseTop.append("g").attr("id", "rooms");

		var numRows = Math.ceil(Math.sqrt(br + ba));

		for (var i = 0; i < numRows; i++) {
			for (var j = 0; j < numRows; j++) {
				if (br > 0) {
					g.append("image")
					.attr("xlink:href", "img/bed.png")
					.attr("x", (sqftTop.attr("width") / numRows) * j)
					.attr("y", (sqftTop.attr("width") / numRows) * i)
					.attr("height", (sqftTop.attr('width') / numRows) + "px")
					.attr("width", (sqftTop.attr("width") / numRows) + "px");

					br--;

				} else if (ba > 0) {
					g.append("image")
					.attr("xlink:href", "img/bath.png")
					.attr("x", (sqftTop.attr("width") / numRows) * j)
					.attr("y", (sqftTop.attr("width") / numRows) * i)
					.attr("height", (sqftTop.attr('width') / numRows) + "px")
					.attr("width", (sqftTop.attr("width") / numRows) + "px");

					ba--;
				}
			}
		}
	}

	/* Sliders */

	// House size
	d3.select("#sqft_living15 input").on("input", function() {
		sqft_living15 = this.value;
		leftDist = (800-sqftScale(sqft_living15))/2;
		house.attr("transform", "translate(" + leftDist + ")");
		drawHouse(floors);
		bsmt.attr("width", sqftScale(sqft_living15));

		houseTop.attr("transform", "translate("
			+ ((800-sqftScaleTop(Math.sqrt(sqft_living15))) / 2) + ","
			+ ((500-sqftScaleTop(Math.sqrt(sqft_living15))) / 2) + ")"
		);
		sqftTop.attr("height", sqftScaleTop(Math.sqrt(sqft_living15)))
		.attr("width", sqftScaleTop(Math.sqrt(sqft_living15)));

		d3.select("#sqft_living15 .currentValue").text(sqft_living15);

		drawRooms();
		pricePrediction();
	});

	// Lot size
	d3.select("#sqft_lot15 input").on("input", function() {
		sqft_lot15 = this.value;
		lotLeftDist = (800-lotScale(sqft_lot15))/2;

		lot.attr("height", lotScale(sqft_lot15));

		lotTop.attr("height", sqftScaleTop(Math.sqrt(sqft_lot15)))
		.attr("width", sqftScaleTop(Math.sqrt(sqft_lot15)))
		.attr("transform", "translate("
			+ ((800-sqftScaleTop(Math.sqrt(sqft_lot15))) / 2) + ","
			+ ((500-sqftScaleTop(Math.sqrt(sqft_lot15))) / 2) + ")"
		);

		d3.select("#sqft_lot15 .currentValue").text((sqft_lot15 / 43560).toFixed(2));

		pricePrediction();
	});

	// Basement size
	d3.select("#sqft_basement input").on("input", function() {
		sqft_basement = this.value;
		bsmt.attr("height", bsmtScale(sqft_basement));
		d3.select("#sqft_basement .currentValue").text(sqft_basement);

		pricePrediction();
	});

	// Number of floors
	d3.select("#floors input").on("input", function () {
		floors = this.value;
		drawHouse(this.value);
		d3.select("#floors .currentValue").text(floors);

		pricePrediction();
	});

	// Year built
	d3.select("#yr_built input").on("input", function() {
		yr_built = this.value;
		houseColor = d3.hsl("hsla(30, " + yearScale(yr_built) + "%, 30%, 1)");
		d3.selectAll(".level").attr("fill", houseColor);
		d3.select("#yr_built .currentValue").text(yr_built);

		if (yr_built > yr_renovated) {
			d3.select("#yr_built .currentValue").style("background-color", "crimson");
			d3.select("#yr_renovated .currentValue").style("background-color", "crimson");
		} else {
			d3.select("#yr_built .currentValue").style("background-color", "#999");
			d3.select("#yr_renovated .currentValue").style("background-color", "#999");
		}

		pricePrediction();
	});

	// Year renovated
	d3.select("#yr_renovated input").on("input", function() {
		yr_renovated = this.value;
		d3.select("#yr_renovated .currentValue").text(yr_renovated);

		if (yr_built > yr_renovated) {
			d3.select("#yr_built .currentValue").style("background-color", "crimson");
			d3.select("#yr_renovated .currentValue").style("background-color", "crimson");
		} else {
			d3.select("#yr_built .currentValue").style("background-color", "#999");
			d3.select("#yr_renovated .currentValue").style("background-color", "#999");
		}

		pricePrediction();
	});

	// Number of bathrooms
	d3.select("#bathrooms input").on("input", function () {
		bathrooms = this.value;
		d3.select("#bathrooms .currentValue").text(bathrooms);

		drawRooms();
		pricePrediction();
	});

	// Number of bedrooms
	d3.select("#bedrooms input").on("input", function () {
		bedrooms = this.value;
		d3.select("#bedrooms .currentValue").text(bedrooms);

		drawRooms();
		pricePrediction();
	});

	// View
	d3.select("#view input").on("input", function () {
		view = this.value;
		d3.select("#view .currentValue").text(viewqualities[view]);
		sky.attr("xlink:href", "img/view-" + viewqualities[view] + ".png");

		pricePrediction();
	});

	// Toggle front and top view
	d3.selectAll(".buttons div").on("click", function() {
		selectedView = this.getAttribute("data-view");
		if (selectedView == "front") {
			d3.select("#front").style("display", "inline-block");
			d3.select("#top").style("display", "none");
		} else {
			d3.select("#front").style("display", "none");
			d3.select("#top").style("display", "inline-block");
		}
	});

	// Draw the house in its initial position
	drawHouse(floors);
	drawRooms();
	pricePrediction();
}

d3.select("#toResult").on("click", function() {
	showHouseStats();
	showHistogramsKC();
	d3.select("#kingCounty").classed("active-tab", true);
	d3.select("#usa").classed("active-tab", false);
});

function showHouseStats() {
	var houseStats = document.getElementById("houseStats");
	houseStats.innerHTML = "<h1>Your house</h1>";
	houseStats.innerHTML += "Valued at <h2>$" + numberWithCommas(getPrediction().toFixed(2)) + "</h2><br>";
	houseStats.innerHTML += "<h2>" + sqft_living15 + "</h2> square feet<br>";
	houseStats.innerHTML += "<h2>" + (sqft_lot15 / 43560).toFixed(1) + "</h2> acre lot<br>";
	houseStats.innerHTML += "<h2>" + sqft_basement + "</h2> sq. ft. basement<br>";
	houseStats.innerHTML += "<h2>" + floors + "</h2> floor(s)<br>";
	houseStats.innerHTML += "<h2>" + bedrooms + "</h2> bedroom(s)<br>";
	houseStats.innerHTML += "<h2>" + bathrooms + "</h2> bathroom(s)<br>";
	houseStats.innerHTML += "Built in <h2>" + yr_built + "</h2><br>";
	if (yr_built < yr_renovated) houseStats.innerHTML += "Renovated in <h2>" + yr_renovated + "</h2><br>";
	houseStats.innerHTML += "<h2>" + viewqualities[view] + "</h2> view quality<br>";
}

/* HISTOGRAMS */

var histogramData;

function drawHistogram(hdata) {
	var margin = {top: 40, right: 30, bottom: 50, left: 50};

	var data = [];
	rawData.forEach(function (d) {
		if (hdata.var != "sqft_lot15") {
			data.push(Number(d[hdata.var]));
		} else {
			data.push(Number(d[hdata.var]) / 43560);
		}
	})

	var svg = d3.select("#histograms").append("svg")
	.attr("width", 220).attr("height", 220).attr("class", "histogram");

	var histogram;
	if (hdata.var == "sqft_lot15") {
		var histogram = d3.histogram().thresholds(hdata.xticks).domain([0, (ranges[hdata.var][1] / 43560)]);
	} else if (hdata.var == "yr_built") {
		var histogram = d3.histogram().thresholds(hdata.xticks).domain(ranges[hdata.var]);
	} else if (hdata.var == "bedrooms" || hdata.var == "bathrooms" || hdata.var == "floors") {
		var histogram = d3.histogram().thresholds(hdata.xticks).domain(d3.extent(hdata.xticks));
	} else {
		var histogram = d3.histogram().thresholds(hdata.xticks).domain([0, ranges[hdata.var][1]]);
	}


	var bins = histogram(data);

	// Create x and y scales
	var xScale = d3.scaleLinear()
	.range([0, (svg.attr("width") - (margin.right + margin.left))])
	.domain([bins[0].x0, bins[bins.length-1].x1]);

	var yScale = d3.scaleLinear()
	.domain([0, d3.max(bins, function(d) { return d.length; })])
	.range([(svg.attr("height") - (margin.top + margin.bottom)), 0]);

	// Create and append axes
	var xAxis = d3.axisBottom(xScale).tickValues(hdata.xticks).tickFormat(d3.format(hdata.tickformat));
	var yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".2s"));

	var g = svg.append("g").attr("transform", "translate("+ margin.left + ", " + margin.top + ")");

	var mouseArea = g.append("rect")
	.attr("width", svg.attr("width") - (margin.right + margin.left))
	.attr("height", svg.attr("height") - (margin.top + margin.bottom))
	.attr("fill", "#e8e8e8");

	g.append("g").call(xAxis).attr("transform", "translate(0," + (svg.attr("height") - (margin.top + margin.bottom)) + ")")
	.selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", function(d) {
        return "rotate(-45)"
     });
	g.append("g").call(yAxis).style("pointer-events", "none");

	// Create histogram bars
	for (var i = 0; i < bins.length; i++) {
		g.append("path")
		.attr("fill", function() {
			if ((Number(hdata.value) < bins[i].x1
				&& Number(hdata.value) >= bins[i].x0)
				|| (Number(hdata.value) == bins[i].x1) && (i == bins.length-1)) {
				return "#006ece";
			}
			return "#b8b8b8";
		})
		.attr("d", "M" + (xScale(bins[i].x0)+1) + " " + yScale(0)
			+ "L" + (xScale(bins[i].x1)-1) + " " + yScale(0)
			+ "L" + (xScale(bins[i].x1)-1) + " " + yScale(bins[i].length)
			+ "L" + (xScale(bins[i].x0)+1) + " " + yScale(bins[i].length) + "z");

		if ((Number(hdata.value) < bins[i].x1
			&& Number(hdata.value) >= bins[i].x0)
			|| (Number(hdata.value) == bins[i].x1) && (i == bins.length-1)) {

			g.append("text")
				.text(hdata.value)
				.attr("transform", "translate(" + ((xScale(bins[i].x0) + xScale(bins[i].x1)) / 2) + ", "
					+ (yScale(bins[i].length) - 5) + ")" )
				.attr("text-anchor", "middle")
				.attr("font-size", 10)
				.attr("fill", "#006ece");
		}
	}

	svg.append("text").text(hdata["label"])
	.attr("transform", "translate(130,10)")
	.attr("font-size", 12)
	.attr("font-weight", "bold")
	.attr("text-anchor", "middle");

	svg.append("text").text("Mean: " + d3.mean(data).toFixed(2) + " | Median: " + d3.median(data).toFixed(1))
	.attr("transform", "translate(130,23)")
	.attr("font-size", 8)
	.attr("text-anchor", "middle");

	svg.append("text").text("# Houses")
	.attr("transform", "translate(10, 100),rotate(-90)")
	.attr("text-anchor", "middle")
	.attr("font-size", 10);

	var infobox = false;

	g.on("mouseover", function() {
		if (!infobox) {
			infobox = svg.append("g").attr("class", "infobox");
			infobox.append("rect").attr("width", 100).attr("height", 25)
			.style("pointer-events", "none")
			.attr("opacity", 0.8);

			infobox.append("text").attr("class", "range")
			.attr("fill", "#fff")
			.attr("transform", "translate(50, 10)")
			.attr("text-anchor", "middle")
			.attr("font-size", 8)
			.style("pointer-events", "none");

			infobox.append("text").attr("class", "count")
			.attr("fill", "#fff")
			.attr("transform", "translate(50, 20)")
			.attr("text-anchor", "middle")
			.attr("font-size", 8)
			.style("pointer-events", "none");
		}
	})

	g.on("mouseout", function() {
		infobox.remove();
		infobox = false;
	})

	g.on("mousemove", function() {
		var binStats = getBinStats(d3.mouse(this));
		if (binStats) {
			infobox.attr("transform", "translate(" + d3.mouse(this)[0] + "," + d3.mouse(this)[1] + ")");
			infobox.select(".range").text(binStats.x0 + " - " + binStats.x1);
			infobox.select(".count").text(binStats.count + " houses (" + ((binStats.count / rawData.length) * 100).toFixed(2) + "%)");
		}

	})

	function getBinStats(mousePosition) {
		var xPos = xScale.invert(mousePosition[0]);
		var format = d3.format(hdata.tickformat);
		var binStats;
		bins.forEach(function(d) {
			if (d.x0 < xPos && d.x1 >= xPos) {
				binStats = {"x0": format(d.x0), "x1": format(d.x1), "count": d.length};
			}
		});
		return binStats;
	}

}

function showHistogramsKC() {
	histogramData = [
	{
		"var": "price",
		"label": "Price ($)",
		"value": getPrediction().toFixed(2),
		"xticks": [0, 500000, 1000000, 1500000, 2000000, 2500000, 3000000, 3500000, 4000000],
		"tickformat": ".2s",
	},
	{
		"var": "sqft_living15",
		"label": "House Size (sq. ft.)",
		"value": sqft_living15,
		"xticks": [0, 1000, 2000, 3000, 4000, 5000, 6000],
		"tickformat": "d",
	},
	{
		"var": "sqft_lot15",
		"label": "Lot Size (acres)",
		"value": (sqft_lot15 / 43560).toFixed(1),
		"xticks": [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
		"tickformat": ".2f",
	},
	{
		"var": "sqft_basement",
		"label": "Basement Size (sq. ft.)",
		"value":sqft_basement,
		"xticks": [0, 250, 500, 750, 1000, 1250, 1500, 1750, 2000],
		"tickformat": "d",
	},
	{
		"var": "floors",
		"label": "Floors",
		"value":floors,
		"xticks": [1, 2, 3, 4],
		"tickformat": ".2s",
	},
	{
		"var":"yr_built",
		"label": "Year Built",
		"value":yr_built,
		"xticks": [1900, 1923, 1946, 1969, 1992, 2015],
		"tickformat": "d",
	},
	{
		"var": "bedrooms",
		"label": "Bedrooms",
		"value":bedrooms,
		"xticks": [1, 2, 3, 4, 5, 6, 7, 8],
		"tickformat": "d",
	},
	{
		"var": "bathrooms",
		"label": "Bathrooms",
		"value":bathrooms,
		"xticks": [1, 2, 3, 4, 5, 6, 7, 8],
		"tickformat": "d",
	}];

	d3.select("#histograms").html("<h1>Houses sold in King County, 2014-2015</h1>");
	histogramData.forEach(function(d) {
		drawHistogram(d);
	})
}