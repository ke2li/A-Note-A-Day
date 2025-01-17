const mongoose = require('mongoose');
const moment = require('moment');
const Schema = mongoose.Schema;

const NoteSchema = new Schema({
    body: String,
    date: String,
    userId: String,
    canEdit: Boolean,
    score: Number
})

NoteSchema.pre('save', function(next) {
    let note = this;
    let timediff = new Date().getTimezoneOffset();
    date = moment(note.date).format("YYYY-MM-DD");
    note.date = date;
    next();
});

NoteSchema.statics.getNotes = function(userId, callback) {
    Note.find({userId:userId})
    .exec(function(err, notes) {
        if (err) {
            return callback(err);
        }
        return callback(null, notes);
    });
}

NoteSchema.statics.getNoteFromID = function(noteId, callback) {
    Note.findOne({_id:noteId})
    .exec(function(err, note) {
        if (err) {
            return callback(err);
        }
        return callback(null, note)
    });
}

NoteSchema.statics.updateRecentNote = function(date) {
    Note.update({date:{$ne:date}}, {$set: {canEdit:false}});
    Note.update({date:date}, {$set: {canEdit:true}});
}

NoteSchema.statics.updateNote = function(noteId, body, score, callback) {
    Note.update({_id:noteId}, {$set: {body:body,score}})
    .exec(function(err) {
        if (err) {
            return (err);
        } else {
            return (null);
        }
    });
}

Note = mongoose.model('Note', NoteSchema)

module.exports = Note