const offerService = require('../../services/v1/offer.service');

exports.getPaginated = async (req, res, next) => {
  try {
    const result = await offerService.getPaginated(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const result = await offerService.getAll();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const fileUrl = req.file ? `/uploads/offers/${req.file.filename}` : '';
    const result = await offerService.create({ ...req.body, imageUrl: fileUrl });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

exports.bulkCreate = async (req, res, next) => {
  try {
    const offers = JSON.parse(req.body.data); // JSON array
    const files = req.files || [];

    const offersWithFiles = offers.map((offer, i) => ({
      ...offer,
      imageUrl: files[i] ? `/uploads/offers/${files[i].filename}` : '',
    }));

    const result = await offerService.bulkCreate(offersWithFiles);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const imageUrl = req.file ? `/uploads/offers/${req.file.filename}` : undefined;
    const result = await offerService.update(req.params.id, {
      ...req.body,
      ...(imageUrl && { imageUrl })
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const result = await offerService.remove(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};


exports.removeByOfferId = async (req, res, next) => {
  try {
    const offerId = req.params.offerId;
    await offerService.removeByOfferId(offerId);
    res.status(200).json({ success: true, message: 'Offer deleted' });
  } catch (error) {
    next(error);
  }
};