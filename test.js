function winner(track1elo, track2elo, winner) {
  const expected = 1 / (1 + 10 ** ((track2elo - track1elo) / 400));
  const K = 30;
  const actual1 = winner == 1 ? 1 : 0;
  const actual2 = winner == 0 ? 1 : 0;
  const newelo1 = track1elo + K * (actual1 - expected);
  const newelo2 = track2elo + K * (actual2 - 1 + expected);
  console.log(newelo1, newelo2);
  return [newelo1, newelo2];
}

winner(1000, 1000, 0);
