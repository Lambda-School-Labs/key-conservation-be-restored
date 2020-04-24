const db = require('../dbConfig');

const CampaignUpdate = require('./updateModel.js');
const CampaignComments = require('./commentsModel.js');
const SkilledImpactRequests = require('./skilledImpactRequestsModel.js');
const log = require('../../logger');

function find() {
  log.verbose('Getting all campaigns from database');
  return db('campaigns')
    .join('users', 'users.id', 'campaigns.user_id')
    .leftJoin('conservationists as cons', 'cons.user_id', 'users.id')
    .select(
      'users.profile_image',
      'users.location',
      'campaigns.*',
      'campaigns.name as camp_name',
      'cons.name as org_name',
    )
    .then((campaigns) => db('comments')
      .join('users', 'users.id', 'comments.user_id')
      .leftJoin('conservationists as cons', 'cons.user_id', 'users.id')
      .leftJoin('supporters as sup', 'sup.user_id', 'users.id')
      .select(
        'comments.*',
        'users.profile_image',
        'cons.name as org_name',
        'sup.name as sup_name',
        'users.is_deactivated',
      )
      // TODO fold this into the query
      .then((comments) => campaigns.map((cam) => {
        log.verbose(`Found campaigns: ${campaigns}`);
        return ({
          ...cam,
          comments: comments
            .filter((com) => com.campaign_id === cam.id && !com.is_deactivated)
            .map((com) => ({
              ...com,
              name: com.org_name || com.sup_name || 'User',
            })),
        });
      })))
    .then((campaigns) => db('users').then((users) => campaigns.filter((camp) => {
      const [user] = users.filter((u) => u.id === camp.user_id);
      return !user.is_deactivated;
    })))
    .catch((err) => {
      throw new Error(err.message);
    });
}

function findCampaign(id) {
  return db('campaigns')
    .where({ id })
    .first();
}

async function findById(id) {
  const campaign = await db('campaigns')
    .where({ 'campaigns.id': id })
    .join('users', 'users.id', 'campaigns.user_id')
    .leftJoin('conservationists as cons', 'cons.user_id', 'campaigns.user_id')
    .where({ 'campaigns.id': id })
    .select(
      'cons.name as org_name',
      'users.profile_image',
      'users.location',
      'users.is_deactivated',
      'campaigns.*',
    )
    .first();
  campaign.updates = await CampaignUpdate.findUpdatesByCamp(id);
  campaign.comments = await CampaignComments.findCampaignComments(id);
  campaign.skilled_impact_requests = await SkilledImpactRequests.find(id);
  return campaign;
}

// TODO this shouldn't be here?
function findUser(id) {
  return db('users')
    .leftJoin('conservationists as cons', 'cons.user_id', 'users.id')
    .leftJoin('supporters as sup', 'sup.user_id', 'users.id')
    .select('*', 'sup.name as sup_name', 'cons.name as cons_name')
    .where({ 'users.id': id })
    .first()
    .then((usr) => ({
      ...usr,
      name: usr.sup_name || usr.cons_name,
    }));
}

async function findCampByUserId(userId) {
  const campaigns = await db('campaigns')
    .where('campaigns.user_id', userId)
    .join('users', 'users.id', 'campaigns.user_id')
    .leftJoin('conservationists as cons', 'cons.user_id', 'users.id')
    .select(
      'cons.name as org_name',
      'users.profile_image',
      'users.location',
      'campaigns.*',
    );
  const withUpdates = campaigns.map(async (campaign) => ({
    ...campaign,
    updates: await CampaignUpdate.findUpdatesByCamp(campaign.id),
    comments: await CampaignComments.findCampaignComments(campaign.id),
  }));
  return Promise.all(withUpdates);
}

async function insert(campaign) {
  log.verbose(`Inserting new campaign ${campaign}`);
  try {
    const [id] = await db('campaigns')
      .insert(campaign)
      .returning('id');
    if (id) {
      return findById(id);
    }
  } catch (e) {
    log.error(`Error inserting campaign: ${e}`);
  }
}

async function update(campaign, id) {
  const editedCamp = await db('campaigns')
    .where({ id })
    .update(campaign);
  if (editedCamp) {
    return findById(id);
  }
}

async function remove(id) {
  const deleted = await db('campaigns')
    .where({ id })
    .del();
  if (deleted) {
    return id;
  }
  return 0;
}

module.exports = {
  find, findCampaign, findById, findUser, findCampByUserId, insert, remove, update,
};