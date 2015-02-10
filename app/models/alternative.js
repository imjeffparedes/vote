var mongoose = require('mongoose');
var Bluebird = require('bluebird');
var mongoose = Bluebird.promisifyAll(require('mongoose'));
var Election = require('./election');
var Vote = require('./vote');
var errors = require('../errors');
var createHash = require('./helpers').createHash;

var Schema = mongoose.Schema;

var alternativeSchema = new Schema({
    description: {
        type: String,
        required: true
    },
    election: {
        type: Schema.Types.ObjectId,
        ref: 'Election'
    }
});

alternativeSchema.pre('remove', function(next) {
    return Vote.findAsync({ alternative: this.id })
        .then(function(votes) {
            return Bluebird.map(votes, function(vote) {
                // Have to call remove on each document to activate Vote's
                // remove-middleware
                return vote.removeAsync();
            });
        }).nodeify(next);
});

alternativeSchema.methods.addVote = function(user) {
    if (!user) throw new Error('Can\'t vote without a user');
    if (!user.active) throw new errors.InactiveUserError(user.username);

    return Election.findByIdAsync(this.election).bind(this)
        .then(function(election) {
            if (!election.active) throw new errors.VoteError('Can\'t vote on an inactive election.');

            var voteHash = createHash(user.username, this.election);
            return Vote.findAsync({ alternative: this.id, hash: voteHash }).bind(this)
            .then(function(votes) {
                if (votes.length) throw new errors.VoteError('You can only vote once per election.');
                var vote = new Vote({ hash: voteHash, alternative: this.id });
                return vote.saveAsync();
            });
        });
};

module.exports = mongoose.model('Alternative', alternativeSchema);