import * as http from 'http'
import {get} from 'https'
import {parseString, ParserOptions} from 'xml2js'
import crypto from 'crypto'
import * as dotenv from "dotenv";

dotenv.config({path: './.env'})

// Define the data structure of the XML data
interface DataStructure {
    date: string;
    rates: { [key: string]: number };
}

// Function to verify the API token
function verifyToken(token: string | string[] | undefined, storedHash: string | undefined): boolean {
    if (token === undefined || storedHash === undefined) {
        return false
    }
    if (Array.isArray(token)) {
        return false
    }
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return hash === storedHash;
}

function fetchXMLData(): Promise<string> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'www.ecb.europa.eu',
            path: '/stats/eurofxref/eurofxref-daily.xml',
            method: 'GET',
        };

        const request = get(options, (response) => {
            let xmlData = '';

            response.on('data', (chunk) => {
                xmlData += chunk;
            });

            response.on('end', () => {
                resolve(xmlData);
            });

            response.on('error', (error) => {
                reject(error);
            });
        });

        request.on('error', (error) => {
            reject(error);
        });

        request.end();
    });
}

function convertXMLToJson(xmlData: string): Promise<DataStructure> {
    return new Promise((resolve, reject) => {
        const parseOptions: ParserOptions = {};
        parseString(xmlData, parseOptions, (error: any, result: any) => {
            if (error) {
                reject(error);
            } else {
                const parsedData: DataStructure = {
                    date: result['gesmes:Envelope']['Cube'][0]['Cube'][0]['$']['time'],
                    rates: {},
                };

                for (const resultKey of result['gesmes:Envelope']['Cube'][0]['Cube'][0]['Cube']) {
                    parsedData.rates[resultKey['$']['currency']] = parseFloat(resultKey['$']['rate']);
                }

                // Add the EUR rate
                parsedData.rates['EUR'] = 1;

                resolve(parsedData);
            }
        });
    });
}

async function startServer(): Promise<void> {
    const server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
        try {
            // Set the response headers
            res.setHeader('Content-Type', 'application/json');
            // Check API token
            let userApiToken = req.headers['authorization'];
            if (userApiToken?.startsWith("Bearer ")) {
                userApiToken = userApiToken.substring(7, userApiToken.length);
            } else {
                res.statusCode = 401;
                res.end('Unauthorized');
                return;
            }
            if (!verifyToken(userApiToken, process.env.API_TOKEN)) {
                console.warn(`${Date.now().toString()} : Invalid API token`);
                res.statusCode = 401;
                res.end('Unauthorized');
                return;
            }
            // Fetch the XML data
            const xmlData = await fetchXMLData();

            // Convert XML to JSON
            const jsonData = await convertXMLToJson(xmlData);

            // Send the JSON data as the response
            const response = JSON.stringify(jsonData);

            res.end(response);
        } catch (error) {
            console.error('Error processing request:', error);

            // Set the response status code and send an error message
            res.statusCode = 500;
            res.end('Internal Server Error');
        }
    });

    const port = 3000;
    const hostname = '0.0.0.0';
    await new Promise<void>((resolve, reject) => {
        server.listen(port, hostname, () => {
            console.log(`Server running at http://localhost:${port}/`);
            resolve();
        });

        server.on('error', (error) => {
            reject(error);
        });
    });
}

startServer().catch((error) => {
    console.error('Error starting server:', error);
});
