const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
    try {
        // Leer el archivo openapi.yml
        const openapiPath = path.join(__dirname, '../../openapi.yml');
        const openapiContent = fs.readFileSync(openapiPath, 'utf8');
        
        // Convertir YAML a JSON para Swagger UI
        const yaml = require('js-yaml');
        const openapiJson = yaml.load(openapiContent);
        
        // Generar HTML con Swagger UI
        const swaggerUIHtml = generateSwaggerUIHtml(JSON.stringify(openapiJson, null, 2));
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,OPTIONS'
            },
            body: swaggerUIHtml
        };
    } catch (error) {
        console.error('Error al servir la documentación:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message: 'Error al cargar la documentación',
                error: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};

function generateSwaggerUIHtml(openapiJson) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mi Condominio API - Documentación</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui.css" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin: 0;
            background: #fafafa;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .swagger-ui .topbar {
            background-color: #2c3e50;
        }
        .swagger-ui .topbar .download-url-wrapper {
            display: none;
        }
        .custom-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
            margin-bottom: 20px;
        }
        .custom-header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .custom-header p {
            margin: 10px 0 0 0;
            font-size: 1.2em;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="custom-header">
        <h1>🏢 Mi Condominio API</h1>
        <p>Documentación interactiva de la API</p>
    </div>
    
    <div id="swagger-ui"></div>
    
    <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                spec: ${openapiJson},
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                theme: "light",
                tryItOutEnabled: true,
                supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
                docExpansion: 'list',
                defaultModelRendering: 'schema',
                showRequestHeaders: true,
                showCommonExtensions: true,
                filter: true,
                tagsSorter: 'alpha',
                operationsSorter: 'alpha'
            });
            
            // Personalizar algunos elementos
            setTimeout(() => {
                const topbar = document.querySelector('.topbar');
                if (topbar) {
                    topbar.style.display = 'none';
                }
            }, 100);
        };
    </script>
</body>
</html>`;
} 