/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import {
  EsaggsExpressionFunctionDefinition,
  IndexPatternLoadExpressionFunctionDefinition,
} from '../../../src/plugins/data/public';
import { buildExpression, buildExpressionFunction } from '../../../src/plugins/expressions/public';
import { getVisSchemas, Vis, BuildPipelineParams } from '../../../src/plugins/visualizations/public';
import { TableExpressionFunctionDefinition } from './table_vis_fn';
import { TableVisConfig, TableVisParams } from './types';

const buildTableVisConfig = (
  schemas: ReturnType<typeof getVisSchemas>,
  visParams: TableVisParams
) => {
  const metrics = schemas.metric;
  const buckets = schemas.bucket || [];
  const visConfig = {
    dimensions: {
      metrics,
      buckets,
      splitRow: schemas.split_row,
      splitColumn: schemas.split_column,
    },
  };

  if (visParams.showPartialRows && !visParams.showMetricsAtAllLevels) {
    // Handle case where user wants to see partial rows but not metrics at all levels.
    // This requires calculating how many metrics will come back in the tabified response,
    // and removing all metrics from the dimensions except the last set.
    const metricsPerBucket = metrics.length / buckets.length;
    visConfig.dimensions.metrics.splice(0, metricsPerBucket * buckets.length - metricsPerBucket);
  }
  return visConfig;
};

export const toExpressionAst = (vis: Vis<TableVisParams>, params: BuildPipelineParams) => {
  const esaggs = buildExpressionFunction<EsaggsExpressionFunctionDefinition>('esaggs', {
    index: buildExpression([
      buildExpressionFunction<IndexPatternLoadExpressionFunctionDefinition>('indexPatternLoad', {
        id: vis.data.indexPattern!.id!,
      }),
    ]),
    metricsAtAllLevels: vis.isHierarchical(),
    partialRows: vis.params.showPartialRows,
    aggs: vis.data.aggs!.aggs.map((agg) => buildExpression(agg.toExpressionAst())),
  });

  const schemas = getVisSchemas(vis, params);

  const visConfig: TableVisConfig = {
    ...vis.params,
    ...buildTableVisConfig(schemas, vis.params),
    title: vis.title,
  };

  const table = buildExpressionFunction<TableExpressionFunctionDefinition>('exportExcelDatatable', {
    visConfig: JSON.stringify(visConfig),
  });

  const ast = buildExpression([esaggs, table]);

  return ast.toAst();
};