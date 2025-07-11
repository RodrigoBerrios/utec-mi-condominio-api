const AWS = require('aws-sdk');

const athena = new AWS.Athena({ region: process.env.AWS_REGION || 'us-east-1' });

const ATHENA_DB = process.env.ATHENA_DATABASE;
const ATHENA_OUTPUT_LOCATION = process.env.ATHENA_OUTPUT_LOCATION;
const ATHENA_WORKGROUP = process.env.ATHENA_WORKGROUP || 'primary';

// Función para esperar a que la consulta de Athena se complete
const waitForQueryToComplete = async (queryExecutionId) => {
    while (true) {
        const params = { QueryExecutionId: queryExecutionId };
        const data = await athena.getQueryExecution(params).promise();
        const state = data.QueryExecution.Status.State;

        if (state === 'SUCCEEDED') {
            return data;
        } else if (state === 'FAILED' || state === 'CANCELLED') {
            const reason = data.QueryExecution.Status.StateChangeReason || 'No se proporcionó una razón específica.';
            throw new Error(`La consulta de Athena falló o fue cancelada. Estado: ${state}. Razón: ${reason}`);
        }
        // Esperar 1 segundo antes de volver a verificar
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
};

// Función para obtener los resultados de la consulta
const getQueryResults = async (queryExecutionId) => {
    const params = { QueryExecutionId: queryExecutionId };
    const data = await athena.getQueryResults(params).promise();
    return data;
};

// Función para formatear los resultados de Athena
const formatResults = (queryResult) => {
    const rows = queryResult.ResultSet.Rows;
    if (rows.length <= 1) { // La primera fila es la cabecera
        return [];
    }

    const headers = rows[0].Data.map(header => header.VarCharValue);
    const formattedData = rows.slice(1).map(row => {
        const rowData = {};
        row.Data.forEach((col, index) => {
            rowData[headers[index]] = col.VarCharValue;
        });
        return rowData;
    });

    return formattedData;
};


exports.handler = async (event) => {
    console.log('Evento recibido:', JSON.stringify(event, null, 2));

    const periodo = event.queryStringParameters && event.queryStringParameters.periodo;

    if (!periodo) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                success: false,
                message: "El parámetro 'periodo' es requerido.",
                timestamp: new Date().toISOString()
            }),
        };
    }
    
    // Validar el formato del período (YYYY-MM)
    const periodoRegex = /^\d{4}-\d{2}$/;
    if (!periodoRegex.test(periodo)) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                success: false,
                message: "Formato de 'periodo' inválido. Use YYYY-MM.",
                timestamp: new Date().toISOString()
            }),
        };
    }

    const query = `SELECT * FROM "${ATHENA_DB}"."g2_lista_gasto_categoria" WHERE periodo = '${periodo}'`;
    
    const params = {
        QueryString: query,
        QueryExecutionContext: {
            Database: ATHENA_DB
        },
        ResultConfiguration: {
            OutputLocation: ATHENA_OUTPUT_LOCATION
        },
        WorkGroup: ATHENA_WORKGROUP
    };

    try {
        const queryExecution = await athena.startQueryExecution(params).promise();
        const queryExecutionId = queryExecution.QueryExecutionId;
        
        await waitForQueryToComplete(queryExecutionId);
        const results = await getQueryResults(queryExecutionId);
        const formattedResults = formatResults(results);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: 'Lista de gastos por categoría obtenida exitosamente.',
                totalRows: formattedResults.length,
                periodo: periodo,
                data: formattedResults,
                timestamp: new Date().toISOString()
            }),
        };
    } catch (error) {
        console.error('Error en la consulta a Athena:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                success: false,
                message: 'Error al ejecutar la consulta en Athena.',
                error: error.message,
                timestamp: new Date().toISOString()
            }),
        };
    }
}; 