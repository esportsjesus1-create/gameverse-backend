import { Request, Response } from 'express';
import * as playerService from '../services/playerService';

export const createPlayer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email } = req.body;

    if (!username) {
      res.status(400).json({
        error: 'Username is required',
      });
      return;
    }

    if (typeof username !== 'string' || username.length < 3 || username.length > 255) {
      res.status(400).json({
        error: 'Username must be between 3 and 255 characters',
      });
      return;
    }

    const existingPlayer = await playerService.getPlayerByUsername(username);
    if (existingPlayer) {
      res.status(409).json({
        error: 'Username already exists',
      });
      return;
    }

    const player = await playerService.createPlayer(username, email);
    res.status(201).json({
      success: true,
      data: player,
    });
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

export const getPlayer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: 'Player ID is required',
      });
      return;
    }

    const player = await playerService.getPlayerById(id);
    if (!player) {
      res.status(404).json({
        error: 'Player not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: player,
    });
  } catch (error) {
    console.error('Error getting player:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

export const updatePlayer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { username, email } = req.body;

    if (!id) {
      res.status(400).json({
        error: 'Player ID is required',
      });
      return;
    }

    if (username !== undefined) {
      if (typeof username !== 'string' || username.length < 3 || username.length > 255) {
        res.status(400).json({
          error: 'Username must be between 3 and 255 characters',
        });
        return;
      }

      const existingPlayer = await playerService.getPlayerByUsername(username);
      if (existingPlayer && existingPlayer.id !== id) {
        res.status(409).json({
          error: 'Username already exists',
        });
        return;
      }
    }

    const player = await playerService.updatePlayer(id, { username, email });
    if (!player) {
      res.status(404).json({
        error: 'Player not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: player,
    });
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

export const deletePlayer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: 'Player ID is required',
      });
      return;
    }

    const deleted = await playerService.deletePlayer(id);
    if (!deleted) {
      res.status(404).json({
        error: 'Player not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Player deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting player:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};
