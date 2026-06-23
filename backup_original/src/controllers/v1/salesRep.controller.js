// src/controllers/v1/salesRep.controller.js
const Service = require('../../services/v1/salesRep.service');

exports.getAll = async (req, res) => {
  const data = await Service.getAll();
  res.json(data);
};

exports.getById = async (req, res) => {
  const item = await Service.getById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Not found' });
  res.json(item);
};

exports.create = async (req, res) => {
  const item = await Service.create(req.body);
  res.status(201).json(item);
};

exports.update = async (req, res) => {
  await Service.update(req.params.id, req.body);
  res.json({ message: 'Updated' });
};

exports.remove = async (req, res) => {
  await Service.remove(req.params.id);
  res.json({ message: 'Deleted' });
};
