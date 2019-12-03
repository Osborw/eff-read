const fetch = require('node-fetch')
const fs = require('fs')
require('dotenv').config()

const ELIGIBLE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']

const parseJSON = filename => {
  const rawdata = fs.readFileSync(`files/${filename}`)
  return JSON.parse(rawdata)
}

export const test = async () => {
  console.log('testing')
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      resolve('foo')
    }, 15000)
  })
}

// READ IN PLAYERS
export const players = async con => {
  return new Promise(async (res, rej) => {
    console.log('Writing players to SQL')
    const URL = 'https://api.sleeper.app/v1/players/nfl'

    await getPlayerData(URL, con)
    console.log('all done')
    res('players')
  })
}

const getPlayerData = async (url, con) => {
  let data
  try {
    const response = await fetch(url)
    console.log('Got data')
    const json = await response.json()
    data = json
    console.log('Retrieved JSON')
  } catch (error) {
    console.log('ERROR', error)
    data = parseJSON('nfl.json')
  }

  await con.execute(`DELETE FROM JSXR.players;`, [], err => {
    console.log('deleting from players')
    if (err) console.log('Error delete from JSXR.players', err)
  })

  Object.keys(data).map(id => {
    const player = data[id]
    const name = player.full_name ? player.full_name.replace(`'`, `\\'`) : null
    const team = player.team || 'FA'
    const position = player.position
    const status = player.status
    const injury_status = player.injury_status
    const active = player.active || false
    const age = player.age || -1
    const years_exp = player.years_exp === null ? -1 : player.years_exp
    const number = player.number || -1
    const height = player.height ? player.height.replace(`'`, `\\'`) : null
    const weight = player.weight || -1
    const depth_chart_position = player.depth_chart_position
    const depth_chart_order = player.depth_chart_order
    const fantasy_data_id =
      player.fantasy_data_id === null ? -1 : player.fantasy_data_id
    const stats_id = player.stats_id === null ? -1 : player.stats_id
    const espn_id = player.espn_id === null ? -1 : player.espn_id
    const injury_start_date =
      player.injury_start_date === undefined ? null : player.injury_start_date
    const search_rank = player.search_rank === null ? -1 : player.search_rank
    const fantasy_positions = player.fantasy_positions || ['unknown']
    if (!isNaN(id) && active && ELIGIBLE_POSITIONS.includes(position)) {
      fantasy_positions.map(async p => {
        const query = `INSERT INTO JSXR.players 
      (id, name, team, position, fantasy_position, status, injury_status, active, age, years_exp, number, height, weight, depth_chart_position, depth_chart_order, search_rank, fantasy_data_id, stats_id, espn_id, injury_start_date)
      VALUES (${id}, '${name}', '${team}', '${position}', '${p}', '${status}', '${injury_status}', ${active}, '${age}', '${years_exp}', '${number}', '${height}', ${weight}, '${depth_chart_position}', ${depth_chart_order}, ${search_rank}, ${fantasy_data_id}, ${stats_id}, ${espn_id}, '${injury_start_date}');`

        await con.execute(query, [], function(error, results, fields) {
          console.log('im doin it')
          if (error) console.log({ error })
        })
      })
    }
  })
}


// READ IN SEASON STATS
export const seasonStats = async con => {
  return new Promise(async (res, rej) => {
    console.log('Writing season stats to SQL')
    const URL = 'https://api.sleeper.app/v1/stats/nfl/regular/2019'

    await getSeasonData(URL, con)
    console.log('also all done')
    res()
  })
}

const getSeasonData = async (url, con) => {
  let data
  try {
    const response = await fetch(url)
    const json = await response.json()
    data = json
    console.log('Retrieved JSON')
  } catch (error) {
    console.log('ERROR', error)
    data = parseJSON('season.json')
  }

  await con.execute(`DELETE FROM JSXR.season;`, [], (err, res) => {
    console.log('deleting from season')
    if (err) console.log('Error delete from JSXR.season', err)
    if (res) console.log(res)
  })

  const query = `SELECT id FROM JSXR.players ORDER BY id ASC;`
  const resp = await con.execute(query, [])

  const fieldsQuery = `DESCRIBE JSXR.season;`
  const fieldsResp = await con.execute(fieldsQuery, [])

  const allFields = fieldsResp[0].map(row => row.Field)

  const ids = resp[0]
  await Promise.all(ids.map(async p => {
    if (data[p.id]) {
      try {
        await con.execute(`INSERT INTO JSXR.season (id) VALUES (${p.id})`, [])
      } catch (err) {
        // console.log({err})
      }
      await Promise.all(Object.keys(data[p.id]).map(async key => {
        if (allFields.includes(key)){
          try {
            await con.execute(
              `UPDATE JSXR.season SET ${key} = ? WHERE id = ?`,
              [data[p.id][key], p.id]
            )
          } catch (err) {
            console.log(err)
          }
        }
      }))
    }
  }))

  console.log('done querying')
}


// READ IN Weekly STATS
export const weeklyStats = async con => {
  return new Promise(async (res, rej) => {
    console.log('Writing weekly stats to SQL')
    const BASE_URL = 'https://api.sleeper.app/v1/stats/nfl/regular/2019/'
    const MAX_WEEKS = 17

    await DoAllWeeks(BASE_URL, con, MAX_WEEKS)

    console.log('also also all done')
    res()
  })
}

const DoAllWeeks = async (url, con, max_weeks) => {
  let i;
  for (i = 1; i <= max_weeks; i++) {
    await getWeeklyData(`${url}${i}`, con, i)
  }
}

const getWeeklyData = async (url, con, week) => {
  let data
  try {
    const response = await fetch(url)
    const json = await response.json()
    data = json
    console.log(`Retrieved JSON for week ${week}`)
  } catch (error) {
    console.log('ERROR', error)
    data = parseJSON('season.json')
  }

  const query = `SELECT id FROM JSXR.players ORDER BY id ASC;`
  const resp = await con.execute(query, [])

  const fieldsQuery = `DESCRIBE JSXR.weeks;`
  const fieldsResp = await con.execute(fieldsQuery, [])
  const allFields = fieldsResp[0].map(row => row.Field)

  const ids = resp[0]
  await Promise.all(ids.map(async p => {
    if (data[p.id] && data[p.id]['gp'] > 0) {
      try {
        await con.execute(`INSERT INTO JSXR.weeks (id, week) VALUES (${p.id}, ${week})`, [])
      } catch (err) {
        // console.log({err})
      }
      await Promise.all(Object.keys(data[p.id]).map(async key => {
        if (allFields.includes(key)){
          try {
            await con.execute(
              `UPDATE JSXR.weeks SET ${key} = ? WHERE id = ? AND week = ?`,
              [data[p.id][key], p.id, week]
            )
          } catch (err) {
            console.log(err)
          }
        }
      }))
    }
  }))

  console.log(`done querying week ${week}`)
}

//GET ROSTERS
export const rosters = async con => {
  return new Promise(async (res, rej) => {
    console.log('Putting players into rosters')
    const URL = `https://api.sleeper.app/v1/league/${process.env.LEAGUE_ID}/rosters`

    await getRosterData(URL, con)
    console.log('also all done')
    res()
  })
}

const getRosterData = async (url, con) => {
  let data
  try {
    const response = await fetch(url)
    const json = await response.json()
    data = json
    console.log('Retrieved JSON')
  } catch (error) {
    console.log('ERROR', error)
    data = []
  }

  await Promise.all(data.map(async user => {
    const id = user.owner_id
    const players = user.players
    console.log(players)
    await Promise.all(players.map(async p => {
      try{
        console.log(p)
        await con.execute(`UPDATE JSXR.players SET owner_id = '${id}' WHERE id = ${p};`, [])
      }
      catch (err) {
        console.log(err)
      }
    }))
  }))

  console.log('done querying')
}