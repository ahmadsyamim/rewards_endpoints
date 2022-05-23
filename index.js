import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import { buildSchema } from 'graphql';

var schema = buildSchema(`
scalar Date
  input RewardInput {
    userId: Int
    dateAt: Date
  }
  input RewardsInput {
    userId: Int
    dateAt: Date
  }
  type Reward {
    userId: Int
    availableAt: Date
    redeemedAt: Date
    expiresAt: Date
  }

  type Rewards {
    userId: ID!
    rewards: [Reward]
  }
  
  type Query {
    getReward(userId: ID!): Reward
    getRewards(userId: ID!, at: Date): Rewards
  }
  type Mutation {
    redeemReward(userId: ID!, input: RewardInput): Reward
  }
`);

class Reward {
  constructor(userId, {availableAt, redeemedAt, expiresAt}) {
    this.userId = userId
    this.availableAt = new Date(availableAt);
    this.redeemedAt = new Date(redeemedAt);
    this.expiresAt = new Date(expiresAt);
  }
}

class Rewards {
    constructor(userId, rewards) {
      this.userId = userId;
      if (rewards.length) {
        this.rewards = rewards;
      }
    }
  }

var dbData = {};
var root = {
  getRewards: ({userId,at}) => {
    let input = [];
    if (dbData[userId]) {
      input = dbData[userId];
    }
    let initDate = new Date(at);
    initDate.setUTCHours(0, 0, 0, 0);  
    if (!(initDate instanceof Date && !isNaN(initDate))) {
      throw new Error('Incorrect date.');
    }
    let getDayDate = initDate.getDay();
    let firstDate = new Date(initDate.setDate(initDate.getDate() - getDayDate));
    let data = [];
    for (let i = 0; i < 7; i++) {
      let d1 = new Date(firstDate);
      let d2 = new Date(firstDate);
      d1 = new Date(d1.setDate(d1.getDate() + i));
      d2 = new Date(d2.setDate(d2.getDate() + i + 1));
      // check for dup
      let objs = [];
      if (dbData[userId]) {
        let objects = dbData[userId];
        objs = objects.filter(function(obj) {
          let cdate = new Date(obj.availableAt);
          cdate.setUTCHours(0, 0, 0, 0); 
          if (cdate.getTime() == d1.getTime()) {
            data.push(obj);
            return obj
          }
        });
      }
      if (!objs.length) {
        var d = {
          availableAt: d1,
          redeemedAt: null,
          expiresAt: d2,
        };
        // save data
        input.push(d);
        data.push(d)
      }
    }
    dbData[userId] = input;
    return new Rewards(userId, data);
  },
  redeemReward: ({userId, input}) => {
    if (!dbData[userId]) {
      throw new Error('Not Found');
    }
    // This replaces all old data, but some apps might want partial update.
    let objects = dbData[userId];
    let initDate = new Date(input.dateAt);
    initDate.setUTCHours(0, 0, 0, 0);  
    if (!(initDate instanceof Date && !isNaN(initDate))) {
      throw new Error('Incorrect date.');
    }
    let toSearch = initDate;
    let results = false;
    let currentDate = new Date();
    currentDate.setUTCHours(0, 0, 0, 0); 
    objects.filter(function(obj) {
      let cdate = new Date(obj.availableAt);
      cdate.setUTCHours(0, 0, 0, 0); 
      if (cdate.getTime() == toSearch.getTime()) {
        let edate = new Date(obj.expiresAt);
        edate.setUTCHours(0, 0, 0, 0); 
        if (edate.getTime() < currentDate.getTime()) {
          throw new Error('This reward is already expired');
        }
        obj.redeemedAt = currentDate;
        results = obj;
      }
    });
    if (!results) {
      throw new Error('Not Found');
    }
    return new Reward(userId, results);
  },
};

var app = express();
app.use('/graphql', graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true,
}));
app.listen(4000, () => {
  console.log('Running a GraphQL API server at localhost:4000/graphql');
});
// Export the Express API
export default app