import Head from 'next/head'
import {useReducer, useState} from "react";
import Error from 'next/error'


export default function Home({exchange_rates, last_updated, error_code}: {
    exchange_rates: { [key: string]: number },
    last_updated: string,
    error_code: number
}) {
    // Setup hooks for the inputs
    const [amount_from, set_amount_from] = useState(1)
    const [currency_from_rate, set_currency_from_rate] = useState(exchange_rates["EUR"])
    const [currency_to_rate, set_currency_to_rate] = useState(exchange_rates["USD"])
    const [converted, calculate] = useReducer((state) => {
        if (amount_from <= 0 || isNaN(amount_from)) {
            return 0
        }
        return (amount_from / currency_from_rate * currency_to_rate).toFixed(2)
    }, currency_to_rate.toFixed(2)) // Round result to 2 decimals

    // Show error page if there is a problem with the API
    if (error_code < 200 || error_code > 299) {
        return <Error statusCode={error_code}/>
    }

    // Event callback function for currencies switch
    function switch_currencies() {
        const temp = currency_from_rate
        set_currency_from_rate(currency_to_rate)
        set_currency_to_rate(temp)
        calculate()
    }

    return (
        <>
            <Head>
                <title>Currency converter</title>
                <meta name="description" content="Currency converter"/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <link rel="icon" href="/favicon.ico"/>
            </Head>
            <main className="bg-indigo-700 min-h-screen flex flex-col justify-center px-96">
                <h2 className={"text-white mb-4 text-2xl"}>Currency converter</h2>
                <form onChange={calculate} className={"grid grid-cols-3 bg-white"}>
                    <div className={"flex flex-col col-auto "}>
                        <label htmlFor="amount_from">Enter amount: </label>
                        <div>
                            <input
                                className={"[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"}
                                type="number" name="amount_from" id="amount_from" defaultValue={1} min={0.01}
                                step={1}
                                onChange={(e) => set_amount_from(parseFloat(e.target.value))}/>
                            {/*List of available currencies*/}
                            <select id="currency_from" value={currency_from_rate}
                                    onChange={(e) => set_currency_from_rate(parseFloat(e.target.value))}>
                                {Object.keys(exchange_rates).map((key: string) => {
                                    return (<option key={key.toString()}
                                                    value={exchange_rates[key].toString()}>{key.toString()}</option>)
                                })}
                            </select>
                        </div>
                    </div>
                    <button type={"button"} onClick={switch_currencies} className={"flex justify-center items-center"}>
                        <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className={"h-5"}
                             xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"></path>
                        </svg>
                    </button>
                    <div className={"flex flex-col col-auto"}>
                        <label htmlFor="amount_to">Result: </label>
                        <div>
                            <input type="number" name="amount_to" id="amount_to" min={0.01} step={1} disabled
                                   value={converted}/>
                            {/*List of available currencies*/}
                            <select id="currency_to" value={currency_to_rate}
                                    onChange={(e) => set_currency_to_rate(parseFloat(e.target.value))}>
                                {Object.keys(exchange_rates).map((key: string) => {
                                    return (<option key={key.toString()}
                                                    value={exchange_rates[key].toString()}>{key.toString()}</option>)
                                })}
                            </select>
                        </div>
                    </div>
                </form>
                <p className={"text-white mt-1 text-sm"}>Last updated: {last_updated}</p>
            </main>
        </>
    )
}

// Server side page generation
export async function getStaticProps() {
    const api_token = process.env.API_TOKEN
    let currency_data: { [key: string]: any } = {rates: null, date: null}
    let error_code = null
    // Attempt to obtain data from API
    if (api_token !== undefined) {
        const headers = new Headers();
        headers.set('authentication', api_token)
        const res = await fetch('http://127.0.0.1:3000/', {
            method: 'POST', headers: {'Authorization': `Bearer ${api_token}`}
        })
        if (res.ok) {
            currency_data = await res.json();
            error_code = res.status
        } else {
            error_code = res.status
        }
    } else {
        error_code = 500
    }
    return {
        props: {
            exchange_rates: currency_data.rates || null,
            last_updated: currency_data.date || null,
            error_code,
        },
        revalidate: 300,
    }
}