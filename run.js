var elasticsearch = require('elasticsearch');
var AWS = require('aws-sdk');
var cw = new AWS.CloudWatch()

console.log(process.env.ES_ENDPOINT);
var elasticsearch_endpoint = process.env.ES_ENDPOINT;

var es = new elasticsearch.Client({
	host: elasticsearch_endpoint,
	log: 'info'
});

/*
cluster
	nodes
		total-count
		data-count
	heap
		total-size-bytes
		used-size-bytes
		free-size-bytes
		percent-used
	indices
		index-count
		indexing-rate

nodes
	each
		heap
			tital-size-bytes
			used-size-bytes
			free-size-bytes
			percent-used
*/

var metrics = [];

doit = function(){
es.cluster.health(function(error, health){
	if(true){
		var keys_we_care_about = ["number_of_nodes", "number_of_data_nodes", "active_primary_shards", "active_shards", "relocating_shards", "initializing_shards", "unassigned_shards", "delayed_unassigned_shards", "number_of_pending_tasks", "number_of_in_flight_fetch", "task_max_waiting_in_queue_millis", "active_shards_percent_as_number"];

	keys_we_care_about.forEach( function(metric) {
		var unit = "Count"

		if(metric == "active_shards_percent_as_number") {
			unit = "Percent";
		}

		if(metric == "task_max_waiting_in_queue_millis" ) {
			unit = "Milliseconds";
		}

		metrics.push({
			MetricName: metric,
			Dimensions: [ {
				Name: "cluster-name",
				Value: health["cluster_name"]
			}],
			Value: health[metric],
			Unit: unit,
			Timestamp: new Date
		});
	}
);


	var node_sums = {
		'jvm-heap-usage-percentage': [],
		'jvm-heap-usage-bytes': []
	};

	es.nodes.stats(function(error, stats){
		Object.keys(stats['nodes']).forEach(function(key) {
			  var val = stats[key];
				node_stats = stats['nodes'][key];

				metrics.push({
					MetricName: "jvm-heap-usage-percentage",
					Dimensions: [
						{
							Name: "node-name",
							Value: node_stats['name']
						},
						{
							Name: "node-type",
							Value: node_stats['attributes']['node_type']
						},
						{
							Name: "cluster-name",
							Value: health["cluster_name"]
						}
					],
					Value: node_stats['jvm']['mem']['heap_used_percent'],
					Unit: "Percent",
					Timestamp: new Date
				});

				metrics.push({
					MetricName: "jvm-heap-usage-bytes",
					Dimensions: [
						{
							Name: "node-name",
							Value: node_stats['name']
						},
						{
							Name: "node-type",
							Value: node_stats['attributes']['node_type']
						},
						{
							Name: "cluster-name",
							Value: health["cluster_name"]
						}
					],
					Value: node_stats['jvm']['mem']['heap_used_in_bytes'],
					Unit: "Bytes",
					Timestamp: new Date
				});

				metrics.push({
					MetricName: "indices-docs-count",
					Dimensions: [
						{
							Name: "node-name",
							Value: node_stats['name']
						},
						{
							Name: "node-type",
							Value: node_stats['attributes']['node_type']
						},
						{
							Name: "cluster-name",
							Value: health["cluster_name"]
						}
					],
					Value: node_stats['indices']['docs']['count'],
					Unit: "Count",
					Timestamp: new Date
				});

		});

	while(metrics.length > 0){
		var put_metrics = metrics.splice(0, 20);
		var put_metrics_payload = {
			MetricData: put_metrics,
			Namespace: "elasticsearch-metrics"
		}

		cw.putMetricData(put_metrics_payload, function(err, data) {
			if (err) console.log(err, err.stack); // an error occurred
			else     console.log(data);           // successful response
		});

	}

	});
} else {
	console.log("failed request");
}
}
);
}

doit();
setInterval(doit, 15000);
