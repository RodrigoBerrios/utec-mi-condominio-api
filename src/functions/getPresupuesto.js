/**
 * Función Lambda para obtener presupuestos desde Amazon Athena
 * GET /presupuesto?periodo=2025-01 (opcional)
 */

const AWS = require("aws-sdk");

// Configurar AWS SDK
const athena = new AWS.Athena();

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  },
  body: JSON.stringify(body),
});

// Configuración de Athena
const ATHENA_CONFIG = {
  Database: process.env.ATHENA_DATABASE || "micondominio_lakehouse_db",
  WorkGroup: process.env.ATHENA_WORKGROUP || "primary",
  OutputLocation:
    process.env.ATHENA_OUTPUT_LOCATION ||
    "s3://g2-mi-condominio-athenas/temp-sql/",
};

// Función para esperar a que la consulta termine
const waitForQueryToComplete = async (queryExecutionId) => {
  console.log(
    `[DEBUG] Iniciando waitForQueryToComplete para QueryExecutionId: ${queryExecutionId}`
  );

  const maxAttempts = 150; // Máximo 5 minutos (150 * 2 segundos)
  let attempts = 0;

  console.log(`[DEBUG] Iniciando while loop con maxAttempts: ${maxAttempts}`);

  while (attempts < maxAttempts) {
    console.log(`[DEBUG] === INICIO DEL INTENTO ${attempts + 1} ===`);
    console.log(
      `[DEBUG] Intento ${
        attempts + 1
      } de ${maxAttempts} para verificar estado de la consulta`
    );

    const params = {
      QueryExecutionId: queryExecutionId,
    };

    try {
      console.log(
        `[DEBUG] Llamando a athena.getQueryExecution con params:`,
        JSON.stringify(params)
      );
      const result = await athena.getQueryExecution(params).promise();

      console.log(`[DEBUG] Respuesta recibida de athena.getQueryExecution`);

      const state = result.QueryExecution.Status.State;
      const submissionDateTime =
        result.QueryExecution.Status.SubmissionDateTime;
      const completionDateTime =
        result.QueryExecution.Status.CompletionDateTime;

      console.log(`[DEBUG] Estado actual de la consulta: ${state}`);
      console.log(`[DEBUG] Tiempo de envío: ${submissionDateTime}`);
      if (completionDateTime) {
        console.log(`[DEBUG] Tiempo de completación: ${completionDateTime}`);
      }

      // Agregar información adicional sobre la consulta
      if (result.QueryExecution.Statistics) {
        console.log(
          `[DEBUG] Estadísticas disponibles:`,
          JSON.stringify(result.QueryExecution.Statistics, null, 2)
        );
      }

      if (state === "SUCCEEDED") {
        console.log(
          `[DEBUG] Consulta completada exitosamente después de ${
            attempts + 1
          } intentos`
        );
        return result.QueryExecution;
      } else if (state === "FAILED" || state === "CANCELLED") {
        const errorReason = result.QueryExecution.Status.StateChangeReason;
        console.error(
          `[ERROR] Query failed with state: ${state}. Reason: ${errorReason}`
        );

        // Agregar más información sobre el error
        if (result.QueryExecution.Status.AthenaError) {
          console.error(
            `[ERROR] Athena Error Details:`,
            JSON.stringify(result.QueryExecution.Status.AthenaError, null, 2)
          );
        }

        throw new Error(
          `Query failed with state: ${state}. Reason: ${errorReason}`
        );
      }

      console.log(
        `[DEBUG] Consulta aún en estado: ${state}. Esperando 2 segundos...`
      );
      console.log(
        `[DEBUG] Incrementando attempts de ${attempts} a ${attempts + 1}`
      );

      // Esperar 2 segundos antes de verificar nuevamente (reducido de 10 segundos)
      console.log(`[DEBUG] Iniciando timeout de 2 segundos...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log(`[DEBUG] Timeout completado, continuando...`);

      attempts++;
      console.log(`[DEBUG] attempts incrementado a: ${attempts}`);
      console.log(`[DEBUG] === FIN DEL INTENTO ${attempts} ===`);
    } catch (error) {
      console.error(
        `[ERROR] Error checking query status on attempt ${attempts + 1}:`,
        error
      );
      console.error(`[ERROR] Error stack:`, error.stack);
      throw new Error(`Error checking query status: ${error.message}`);
    }
  }

  const timeoutError =
    "Query timeout: La consulta tardó más de 5 minutos en completarse";
  console.error(`[ERROR] ${timeoutError}`);
  throw new Error(timeoutError);
};

// Función para obtener los resultados de la consulta
const getQueryResults = async (queryExecutionId) => {
  console.log(
    `[DEBUG] Iniciando getQueryResults para QueryExecutionId: ${queryExecutionId}`
  );

  const params = {
    QueryExecutionId: queryExecutionId,
    MaxResults: 1000, // Ajustar según necesidades
  };

  try {
    console.log(
      `[DEBUG] Llamando a athena.getQueryResults con params:`,
      JSON.stringify(params)
    );
    const result = await athena.getQueryResults(params).promise();

    console.log(
      `[DEBUG] Resultados obtenidos. Cantidad de filas en ResultSet: ${result.ResultSet.Rows.length}`
    );
    return result;
  } catch (error) {
    console.error(
      `[ERROR] Error getting query results for QueryExecutionId ${queryExecutionId}:`,
      error
    );
    throw new Error(`Error getting query results: ${error.message}`);
  }
};

// Función para formatear los resultados en un formato más amigable
const formatResults = (results) => {
  console.log(`[DEBUG] Iniciando formatResults`);

  try {
    const rows = results.ResultSet.Rows;
    const headers = results.ResultSet.ResultSetMetadata.ColumnInfo.map(
      (col) => col.Name
    );

    console.log(`[DEBUG] Headers encontrados:`, headers);
    console.log(`[DEBUG] Total de filas (incluyendo header): ${rows.length}`);

    // Convertir las filas en objetos con las columnas como propiedades
    const formattedData = rows.slice(1).map((row) => {
      const obj = {};
      row.Data.forEach((cell, index) => {
        obj[headers[index]] = cell.VarCharValue || null;
      });
      return obj;
    });

    console.log(
      `[DEBUG] Datos formateados exitosamente. Filas de datos: ${formattedData.length}`
    );

    return {
      headers,
      data: formattedData,
      totalRows: formattedData.length,
    };
  } catch (error) {
    console.error(`[ERROR] Error formatting query results:`, error);
    throw new Error(`Error formatting results: ${error.message}`);
  }
};

exports.handler = async (event) => {
  try {
    console.log(
      "Evento recibido para getPresupuesto:",
      JSON.stringify(event, null, 2)
    );

    // Log de configuración de Athena
    console.log(
      `[DEBUG] Configuración de Athena:`,
      JSON.stringify(ATHENA_CONFIG, null, 2)
    );
    console.log(
      `[DEBUG] AWS Region:`,
      process.env.AWS_REGION || "No especificada"
    );
    console.log(`[DEBUG] Variables de entorno de Athena:`);
    console.log(
      `  - ATHENA_DATABASE: ${
        process.env.ATHENA_DATABASE || "No especificada (usando default)"
      }`
    );
    console.log(
      `  - ATHENA_WORKGROUP: ${
        process.env.ATHENA_WORKGROUP || "No especificada (usando default)"
      }`
    );
    console.log(
      `  - ATHENA_OUTPUT_LOCATION: ${
        process.env.ATHENA_OUTPUT_LOCATION || "No especificada (usando default)"
      }`
    );

    // Verificar que sea una petición GET
    if (event.httpMethod !== "GET") {
      return response(405, {
        success: false,
        message: "Método no permitido. Solo se acepta GET",
        timestamp: new Date().toISOString(),
      });
    }

    // Obtener el parámetro de período desde los query parameters
    const periodo = event.queryStringParameters?.periodo;

    console.log(`[DEBUG] Parámetro período recibido: ${periodo}`);

    // Construir la query base
    let query = "select (coalesce(total_mantenimiento,0) + coalesce(total_seguridad,0) + coalesce(total_limpieza,0)) as total, * from micondominio_lakehouse_db.g2_presupuestos_tb";

    // Si se proporcionó el parámetro período, agregar el filtro WHERE
    if (periodo) {
      query += ` WHERE periodo = '${periodo}'`;
      console.log(`[DEBUG] Filtro de período aplicado: ${periodo}`);
    } else {
      console.log(
        `[DEBUG] No se proporcionó período, ejecutando consulta sin filtro`
      );
    }

    console.log("Ejecutando consulta de presupuestos:", query);

    // Configurar parámetros para la consulta
    const queryParams = {
      QueryString: query,
      QueryExecutionContext: {
        Database: ATHENA_CONFIG.Database,
      },
      WorkGroup: ATHENA_CONFIG.WorkGroup,
      ResultConfiguration: {
        OutputLocation: ATHENA_CONFIG.OutputLocation,
      },
    };

    console.log(
      `[DEBUG] Configuración de la consulta:`,
      JSON.stringify(queryParams, null, 2)
    );

    // Ejecutar la consulta
    let queryExecution;
    try {
      console.log(`[DEBUG] Iniciando ejecución de consulta...`);
      queryExecution = await athena.startQueryExecution(queryParams).promise();
      const queryExecutionId = queryExecution.QueryExecutionId;
      console.log("Query Execution ID:", queryExecutionId);
    } catch (error) {
      console.error(`[ERROR] Error starting query execution:`, error);
      throw new Error(`Error starting query execution: ${error.message}`);
    }

    const queryExecutionId = queryExecution.QueryExecutionId;

    // Esperar a que la consulta termine
    console.log(`[DEBUG] Esperando a que la consulta termine...`);
    const completedQuery = await waitForQueryToComplete(queryExecutionId);
    console.log(`[DEBUG] Consulta completada exitosamente`);

    // Obtener los resultados
    console.log(`[DEBUG] Obteniendo resultados de la consulta...`);
    const results = await getQueryResults(queryExecutionId);
    console.log(`[DEBUG] Resultados obtenidos exitosamente`);

    // Formatear los resultados
    console.log(`[DEBUG] Formateando resultados...`);
    const formattedResults = formatResults(results);
    console.log(`[DEBUG] Resultados formateados exitosamente`);

    // Procesar los resultados finales
    console.log(`[DEBUG] Procesando resultados finales...`);
    const processedResults = {
      queryExecutionId,
      query: query,
      executionTime: completedQuery.Statistics.TotalExecutionTimeInMillis,
      dataScanned: completedQuery.Statistics.DataScannedInBytes,
      rowsReturned: formattedResults.totalRows,
      headers: formattedResults.headers,
      presupuestos: formattedResults.data,
    };

    console.log(
      `[DEBUG] Query completado exitosamente. Rows returned: ${formattedResults.totalRows}`
    );

    console.log(`[DEBUG] Preparando respuesta exitosa...`);
    return response(200, {
      success: true,
      message: periodo
        ? `Presupuestos obtenidos exitosamente para el período ${periodo}`
        : "Presupuestos obtenidos exitosamente",
      totalRows: formattedResults.totalRows,
      periodo: periodo || null,
      presupuestos: formattedResults.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[ERROR] Error en getPresupuesto:`, error);
    console.error(`[ERROR] Stack trace:`, error.stack);

    return response(500, {
      success: false,
      message: "Error al obtener los presupuestos desde Athena",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
