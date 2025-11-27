const Groq = jest.fn().mockImplementation(() => ({
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{ message: { content: "mock" } }]
      })
    }
  },
  audio: {
    transcriptions: {
      create: jest.fn().mockResolvedValue({ text: "transcribed" })
    }
  }
}));

module.exports = Groq;
