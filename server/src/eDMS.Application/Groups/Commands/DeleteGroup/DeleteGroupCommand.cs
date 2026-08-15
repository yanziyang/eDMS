using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;

namespace eDMS.Application.Groups.Commands.DeleteGroup;

public sealed record DeleteGroupCommand(Guid GroupId) : IRequest;
