
const {
    AthenaClient,
    StartQueryExecutionCommand,
    GetQueryExecutionCommand,
    GetQueryResultsCommand
} = require("@aws-sdk/client-athena");

const athenaClient = new AthenaClient({ region: process.env.AWS_REGION });

const ATHENA_DB = process.env.ATHENA_DATABASE;
const ATHENA_OUTPUT_LOCATION = process.env.ATHENA_OUTPUT_LOCATION;
const ATHENA_WORKGROUP = process.env.ATHENA_WORKGROUP;
const FUNCTION_NAME = process.env.FUNCTION_NAME;

const handler = async (event) => {
    console.log(`[${FUNCTION_NAME}] INIT`);
    const { periodo } = event.queryStringParameters || {};

    if (!periodo) {
        return {
            statusCode: 400,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true
            },
            body: JSON.stringify({
                success: false,
                message: "El parámetro 'periodo' es requerido.",
                timestamp: new Date().toISOString()
            }),
        };
    }

    const query = `
        SELECT
            *
        FROM "micondominio_lakehouse_db"."g2_presupuesto_vs_gasto_categoria"
        WHERE periodo = '${periodo}'
    `;

    console.log(`[${FUNCTION_NAME}] QUERY: ${query}`);

    const startQueryExecutionCommand = new StartQueryExecutionCommand({
        QueryString: query,
        QueryExecutionContext: {
            Database: ATHENA_DB,
        },
        ResultConfiguration: {
            OutputLocation: ATHENA_OUTPUT_LOCATION,
        },
        WorkGroup: ATHENA_WORKGROUP
    });

    try {
        const { QueryExecutionId } = await athenaClient.send(startQueryExecutionCommand);
        console.log(`[${FUNCTION_NAME}] QueryExecutionId: ${QueryExecutionId}`);

        let queryState = null;
        do {
            const getQueryExecutionCommand = new GetQueryExecutionCommand({ QueryExecutionId });
            const queryExecution = await athenaClient.send(getQueryExecutionCommand);
            queryState = queryExecution.QueryExecution.Status.State;

            console.log(`[${FUNCTION_NAME}] Query state: ${queryState}`);

            if (["FAILED", "CANCELLED"].includes(queryState)) {
                const reason = queryExecution.QueryExecution.Status.StateChangeReason;
                console.error(`[${FUNCTION_NAME}] Query failed or cancelled. Reason: ${reason}`);
                throw new Error(`Query failed or cancelled. Reason: ${reason}`);
            }

            if (queryState !== "SUCCEEDED") {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        } while (queryState !== "SUCCEEDED");

        const getQueryResultsCommand = new GetQueryResultsCommand({ QueryExecutionId });
        const results = await athenaClient.send(getQueryResultsCommand);
        const rows = results.ResultSet.Rows;
        
        if (rows.length === 0) {
            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Credentials": true
                },
                body: JSON.stringify({
                    success: true,
                    message: "No se encontraron datos para el período especificado.",
                    totalRows: 0,
                    presupuesto: [],
                    timestamp: new Date().toISOString()
                }),
            };
        }

        const columns = rows[0].Data.map(col => col.VarCharValue);
        const data = rows.slice(1).map(row => {
            const item = {};
            row.Data.forEach((col, i) => {
                const key = columns[i];
                const value = col.VarCharValue;
                item[key] = isNaN(value) ? value : Number(value);
            });
            return item;
        });

        console.log(`[${FUNCTION_NAME}] END`);

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true
            },
            body: JSON.stringify({
                success: true,
                message: "Presupuesto obtenido exitosamente",
                totalRows: data.length,
                presupuesto: data,
                timestamp: new Date().toISOString()
            }),
        };
    } catch (error) {
        console.error(`[${FUNCTION_NAME}] Error executing Athena query:`, error);
        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true
            },
            body: JSON.stringify({
                success: false,
                message: "Error al ejecutar la consulta en Athena",
                error: error.message,
                timestamp: new Date().toISOString()
            }),
        };
    }
};

module.exports = {
    handler,
}; 